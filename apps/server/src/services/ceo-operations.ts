import { eq, and, sql, desc } from '@buildcrew/db';
import { db, companies, agents, tasks, chatThreads, chatMessages } from '@buildcrew/db';
import { callAI } from './ai-client.js';
import { emitEvent } from '../ws.js';

// Debounce: avoid spamming CEO messages for rapid-fire events
const lastCEOMessage = new Map<string, number>();
const MIN_INTERVAL_MS = 10000; // at least 10s between CEO operational messages

function shouldThrottle(companyId: string): boolean {
  const last = lastCEOMessage.get(companyId) ?? 0;
  if (Date.now() - last < MIN_INTERVAL_MS) return true;
  lastCEOMessage.set(companyId, Date.now());
  return false;
}

/**
 * B-04: CEO reacts when an agent completes a task.
 * Called from agent-executor.ts after task status → 'done'.
 */
export async function onTaskCompleted(params: {
  companyId: string;
  taskId: string;
  agentId: string | null;
}): Promise<void> {
  const { companyId, taskId, agentId } = params;
  if (shouldThrottle(companyId)) return;

  try {
    const ceo = await findCEO(companyId);
    if (!ceo) return;

    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) return;

    const agent = agentId
      ? (await db.select().from(agents).where(eq(agents.id, agentId)))[0]
      : null;

    // Check milestone: count completed vs total
    const allTasks = await db.select({ status: tasks.status }).from(tasks).where(eq(tasks.companyId, companyId));
    const total = allTasks.length;
    const done = allTasks.filter((t) => t.status === 'done').length;

    // Build CEO message
    const agentName = agent?.name ?? 'The team';
    let message: string;

    // Milestone check: 25%, 50%, 75%, 100%
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const isMilestone = [25, 50, 75, 100].some((m) => pct >= m && pct - Math.round(((done - 1) / total) * 100) < m - Math.round(((done - 1) / total) * 100));

    if (isMilestone && pct === 100) {
      message = await generateCEOMessage(ceo, companyId, 'milestone_complete', {
        agentName, taskTitle: task.title, done, total, pct,
      });
    } else if (isMilestone) {
      message = await generateCEOMessage(ceo, companyId, 'milestone', {
        agentName, taskTitle: task.title, done, total, pct,
      });
    } else {
      message = await generateCEOMessage(ceo, companyId, 'task_completed', {
        agentName, taskTitle: task.title, done, total, pct,
      });
    }

    const threadId = await getOrCreateCEOThread(companyId, ceo.id);
    if (!threadId) return;

    await db.insert(chatMessages).values({
      threadId, senderType: 'agent', senderAgentId: ceo.id,
      content: message, messageType: 'text',
    });
    await db.update(chatThreads).set({ updatedAt: new Date() }).where(eq(chatThreads.id, threadId));

    emitEvent(companyId, 'ceo.operational_update', {
      type: isMilestone ? 'milestone' : 'task_completed',
      thread_id: threadId,
      task_id: taskId,
      message,
    });
  } catch (e) {
    console.error('[CEO Operations] onTaskCompleted error:', e);
  }
}

/**
 * B-04: CEO reacts when a Guardian alert fires (critical/emergency).
 * Called from guardian engine after alert creation.
 */
export async function onGuardianAlert(params: {
  companyId: string;
  agentId?: string;
  taskId?: string;
  severity: string;
  category: string;
  description: string;
}): Promise<void> {
  const { companyId, severity, category, description } = params;

  // Only react to critical and emergency alerts
  if (severity !== 'critical' && severity !== 'emergency') return;
  if (shouldThrottle(companyId)) return;

  try {
    const ceo = await findCEO(companyId);
    if (!ceo) return;

    const agent = params.agentId
      ? (await db.select().from(agents).where(eq(agents.id, params.agentId)))[0]
      : null;

    const message = await generateCEOMessage(ceo, companyId, 'guardian_alert', {
      agentName: agent?.name ?? 'Unknown',
      severity,
      category,
      description,
    });

    const threadId = await getOrCreateCEOThread(companyId, ceo.id);
    if (!threadId) return;

    await db.insert(chatMessages).values({
      threadId, senderType: 'agent', senderAgentId: ceo.id,
      content: message, messageType: 'text',
    });
    await db.update(chatThreads).set({ status: 'waiting_user', updatedAt: new Date() }).where(eq(chatThreads.id, threadId));

    emitEvent(companyId, 'ceo.operational_update', {
      type: 'guardian_alert',
      thread_id: threadId,
      severity,
      message,
    });
  } catch (e) {
    console.error('[CEO Operations] onGuardianAlert error:', e);
  }
}

/**
 * B-04: CEO reacts when a task gets blocked or an agent encounters an error.
 * Called from agent-executor.ts when task → 'blocked'.
 */
export async function onTaskBlocked(params: {
  companyId: string;
  taskId: string;
  agentId: string | null;
  reason: string;
}): Promise<void> {
  const { companyId, taskId, agentId, reason } = params;
  if (shouldThrottle(companyId)) return;

  try {
    const ceo = await findCEO(companyId);
    if (!ceo) return;

    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) return;

    const agent = agentId
      ? (await db.select().from(agents).where(eq(agents.id, agentId)))[0]
      : null;

    const message = await generateCEOMessage(ceo, companyId, 'task_blocked', {
      agentName: agent?.name ?? 'The team',
      taskTitle: task.title,
      reason,
    });

    const threadId = await getOrCreateCEOThread(companyId, ceo.id);
    if (!threadId) return;

    await db.insert(chatMessages).values({
      threadId, senderType: 'agent', senderAgentId: ceo.id,
      content: message, messageType: 'text',
    });
    await db.update(chatThreads).set({ status: 'waiting_user', updatedAt: new Date() }).where(eq(chatThreads.id, threadId));

    emitEvent(companyId, 'ceo.operational_update', {
      type: 'task_blocked',
      thread_id: threadId,
      task_id: taskId,
      message,
    });
  } catch (e) {
    console.error('[CEO Operations] onTaskBlocked error:', e);
  }
}

/**
 * B-05v2: CEO reacts when review completes (pass or fail).
 * Called from agent-executor.ts after autoReviewTask.
 */
export async function onReviewCompleted(params: {
  companyId: string;
  taskId: string;
  agentId: string | null;
  reviewerName: string;
  passed: boolean;
  score?: number;
  feedback?: string;
}): Promise<void> {
  const { companyId, taskId, passed, reviewerName, score, feedback } = params;
  if (shouldThrottle(companyId)) return;

  try {
    const ceo = await findCEO(companyId);
    if (!ceo) return;

    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) return;

    const eventType = passed ? 'review_passed' : 'review_rejected';
    const message = await generateCEOMessage(ceo, companyId, eventType, {
      reviewerName,
      taskTitle: task.title,
      score: score ?? 0,
      feedback: feedback ?? '',
      issueCount: feedback ? feedback.split('\n').filter((l) => l.trim()).length : 0,
    });

    const threadId = await getOrCreateCEOThread(companyId, ceo.id);
    if (!threadId) return;

    await db.insert(chatMessages).values({
      threadId, senderType: 'agent', senderAgentId: ceo.id,
      content: message, messageType: 'text',
    });
    await db.update(chatThreads).set({ updatedAt: new Date() }).where(eq(chatThreads.id, threadId));

    emitEvent(companyId, 'ceo.operational_update', {
      type: eventType,
      thread_id: threadId,
      task_id: taskId,
      message,
    });
  } catch (e) {
    console.error('[CEO Operations] onReviewCompleted error:', e);
  }
}

/**
 * B-05v2: CEO warns when budget hits 50% or 80%.
 * Called from ai-client.ts or heartbeat after recording usage.
 */
export async function onBudgetThreshold(params: {
  companyId: string;
  budgetPct: number;
  budgetSpent: number;
  budgetMonthly: number;
}): Promise<void> {
  const { companyId, budgetPct, budgetSpent, budgetMonthly } = params;

  // Only trigger at 50% and 80% thresholds
  if (budgetPct < 50) return;
  const thresholdKey = budgetPct >= 80 ? `${companyId}:budget:80` : `${companyId}:budget:50`;
  if (shouldThrottle(thresholdKey)) return;

  try {
    const ceo = await findCEO(companyId);
    if (!ceo) return;

    const message = await generateCEOMessage(ceo, companyId, 'budget_warning', {
      budgetPct: Math.round(budgetPct),
      budgetSpent: Math.round(budgetSpent * 100) / 100,
      budgetMonthly,
    });

    const threadId = await getOrCreateCEOThread(companyId, ceo.id);
    if (!threadId) return;

    await db.insert(chatMessages).values({
      threadId, senderType: 'agent', senderAgentId: ceo.id,
      content: message, messageType: 'text',
    });
    await db.update(chatThreads).set({ updatedAt: new Date() }).where(eq(chatThreads.id, threadId));

    emitEvent(companyId, 'ceo.operational_update', {
      type: 'budget_warning',
      thread_id: threadId,
      budget_pct: Math.round(budgetPct),
      message,
    });
  } catch (e) {
    console.error('[CEO Operations] onBudgetThreshold error:', e);
  }
}

/**
 * B-05v2: CEO sends recap when user hasn't logged in for 3+ days.
 * Called from active-thread endpoint when stale > 3 days.
 */
export async function onUserReturnAfterAbsence(params: {
  companyId: string;
  daysSinceLastVisit: number;
}): Promise<void> {
  const { companyId, daysSinceLastVisit } = params;
  if (daysSinceLastVisit < 3) return;

  try {
    const ceo = await findCEO(companyId);
    if (!ceo) return;

    const allTasks = await db.select({ status: tasks.status }).from(tasks).where(eq(tasks.companyId, companyId));
    const done = allTasks.filter((t) => t.status === 'done').length;
    const inProgress = allTasks.filter((t) => t.status === 'in_progress').length;
    const blocked = allTasks.filter((t) => t.status === 'blocked').length;

    const message = await generateCEOMessage(ceo, companyId, 'user_return', {
      days: daysSinceLastVisit,
      tasksCompleted: done,
      tasksInProgress: inProgress,
      tasksBlocked: blocked,
      totalTasks: allTasks.length,
    });

    const threadId = await getOrCreateCEOThread(companyId, ceo.id);
    if (!threadId) return;

    await db.insert(chatMessages).values({
      threadId, senderType: 'agent', senderAgentId: ceo.id,
      content: message, messageType: 'text',
    });
    await db.update(chatThreads).set({ updatedAt: new Date() }).where(eq(chatThreads.id, threadId));

    emitEvent(companyId, 'ceo.operational_update', {
      type: 'user_return',
      thread_id: threadId,
      days_absent: daysSinceLastVisit,
      message,
    });
  } catch (e) {
    console.error('[CEO Operations] onUserReturnAfterAbsence error:', e);
  }
}

// --- Helpers ---

async function findCEO(companyId: string): Promise<typeof agents.$inferSelect | null> {
  const allAgents = await db.select().from(agents).where(eq(agents.companyId, companyId));
  return (
    allAgents.find((a) => a.title?.toLowerCase().includes('ceo')) ??
    allAgents.find((a) => a.level === 'executive') ??
    null
  );
}

async function getOrCreateCEOThread(companyId: string, ceoId: string): Promise<string | null> {
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  if (!company?.userId) return null;

  const [existing] = await db.select().from(chatThreads).where(
    and(
      eq(chatThreads.companyId, companyId),
      eq(chatThreads.agentId, ceoId),
      sql`${chatThreads.status} != 'closed'`,
    ),
  ).orderBy(desc(chatThreads.updatedAt)).limit(1);

  if (existing) return existing.id;

  const [thread] = await db.insert(chatThreads).values({
    companyId, agentId: ceoId, userId: company.userId,
    threadType: 'report', status: 'active',
  }).returning();

  return thread?.id ?? null;
}

type MessageContext = Record<string, unknown>;

async function generateCEOMessage(
  ceo: typeof agents.$inferSelect,
  companyId: string,
  eventType: string,
  context: MessageContext,
): Promise<string> {
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));

  const promptMap: Record<string, string> = {
    task_completed: `${context['agentName']} just completed "${context['taskTitle']}". Progress: ${context['done']}/${context['total']} tasks done (${context['pct']}%). Give a brief, natural update.`,
    milestone: `MILESTONE! ${context['done']}/${context['total']} tasks complete (${context['pct']}%). ${context['agentName']} just finished "${context['taskTitle']}". Celebrate briefly and summarize progress.`,
    milestone_complete: `ALL ${context['total']} TASKS COMPLETE! ${context['agentName']} just finished the last one: "${context['taskTitle']}". Give a warm congratulations and ask what's next.`,
    task_blocked: `${context['agentName']} hit a problem on "${context['taskTitle']}": ${context['reason']}. Relay this to the user and ask for their input.`,
    guardian_alert: `ALERT [${context['severity']}]: ${context['description']}. ${context['agentName']} triggered a ${context['category']} alert. Inform the user and ask what action to take.`,
    review_passed: `${context['reviewerName']} reviewed "${context['taskTitle']}" and approved it. Score: ${context['score']}/10. Give a brief positive update.`,
    review_rejected: `${context['reviewerName']} reviewed "${context['taskTitle']}" and found ${context['issueCount']} issue(s). Feedback: ${context['feedback']}. The task has been sent back for revision. Relay this briefly.`,
    budget_warning: `Budget alert: ${context['budgetPct']}% used ($${context['budgetSpent']}/$${context['budgetMonthly']}). Ask the user if they want to adjust spending or continue.`,
    user_return: `The user hasn't been here for ${context['days']} days. While they were away: ${context['tasksCompleted']} tasks completed, ${context['tasksInProgress']} in progress, ${context['tasksBlocked']} blocked (out of ${context['totalTasks']} total). Give a warm welcome-back summary.`,
  };

  const instruction = promptMap[eventType] ?? `Event: ${eventType}. Context: ${JSON.stringify(context)}`;

  try {
    const runtime = ceo.runtimeConfig as { provider?: string; model?: string } | null;
    const result = await callAI({
      userId: company?.userId ?? '',
      agentId: ceo.id,
      companyId,
      provider: runtime?.provider ?? 'deepseek',
      model: runtime?.model ?? 'deepseek-chat',
      systemPrompt: `You are ${ceo.name}, CEO of ${company?.name ?? 'the company'}. You are giving a brief operational update. Keep it under 150 chars. Sound like a real CEO, not a chatbot. No emoji. No technical jargon.`,
      messages: [{ role: 'user', content: instruction }],
      requestType: 'chat',
      allowPlatformKey: true,
      maxTokens: 200,
    });
    return result.content;
  } catch {
    // Fallback: generate without AI
    return buildFallbackMessage(eventType, context);
  }
}

function buildFallbackMessage(eventType: string, ctx: MessageContext): string {
  switch (eventType) {
    case 'task_completed':
      return `${ctx['agentName']} completed "${ctx['taskTitle']}". Progress: ${ctx['done']}/${ctx['total']} tasks done.`;
    case 'milestone':
      return `Milestone reached! ${ctx['done']}/${ctx['total']} tasks complete (${ctx['pct']}%).`;
    case 'milestone_complete':
      return `All ${ctx['total']} tasks complete! Great work, team. What's next?`;
    case 'task_blocked':
      return `${ctx['agentName']} is blocked on "${ctx['taskTitle']}": ${ctx['reason']}. Need your input.`;
    case 'guardian_alert':
      return `Alert [${ctx['severity']}]: ${ctx['description']}. Please review.`;
    case 'review_passed':
      return `${ctx['reviewerName']} approved "${ctx['taskTitle']}". Score: ${ctx['score']}/10.`;
    case 'review_rejected':
      return `${ctx['reviewerName']} found issues in "${ctx['taskTitle']}". Sent back for revision.`;
    case 'budget_warning':
      return `Budget ${ctx['budgetPct']}% used ($${ctx['budgetSpent']}/$${ctx['budgetMonthly']}). Need to adjust?`;
    case 'user_return':
      return `Welcome back! You were away ${ctx['days']} days. ${ctx['tasksCompleted']} tasks done, ${ctx['tasksBlocked']} blocked.`;
    default:
      return `Update: ${eventType}`;
  }
}

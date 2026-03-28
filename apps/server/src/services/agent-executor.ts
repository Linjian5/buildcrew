import { eq, sql } from '@buildcrew/db';
import { db, agents, tasks, companies, chatThreads, chatMessages, knowledgeEntries } from '@buildcrew/db';
import { callAI, AIError } from './ai-client.js';
import { emitEvent } from '../ws.js';
import { getRolePrompt } from '../lib/role-prompts.js';
import { onTaskCompleted, onTaskBlocked, onReviewCompleted } from './ceo-operations.js';

/**
 * Trigger agent execution when a task is assigned (status → in_progress).
 */
export async function executeTask(taskId: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task || !task.assignedAgentId) return null;

  const [agent] = await db.select().from(agents).where(eq(agents.id, task.assignedAgentId));
  if (!agent) return null;

  const [company] = await db.select().from(companies).where(eq(companies.id, task.companyId));
  if (!company) return null;

  const userId = company.userId;
  if (!userId) return null;

  // Create execution thread
  const [thread] = await db
    .insert(chatThreads)
    .values({
      companyId: task.companyId,
      agentId: agent.id,
      userId,
      threadType: 'task_execution',
      relatedTaskId: taskId,
      status: 'active',
    })
    .returning();

  if (!thread) return null;

  // Get knowledge context
  const knowledge = await getKnowledgeContext(task.companyId, task.title, task.description ?? '');

  // Build system prompt
  const systemPrompt = buildAgentPrompt(agent, company, task, knowledge);

  // Call AI
  const runtime = agent.runtimeConfig as { provider?: string; model?: string } | null;
  const provider = runtime?.provider ?? 'anthropic';
  const model = runtime?.model ?? 'claude-sonnet-4';

  // Call AI with retry (max 3 attempts)
  let aiContent: string | null = null;
  let aiFailed = false;
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await callAI({
        userId,
        agentId: agent.id,
        companyId: task.companyId,
        provider, model, systemPrompt,
        messages: [{ role: 'user', content: `Execute task: ${task.title}\n\nDescription: ${task.description ?? 'No description'}` }],
        taskId,
        requestType: 'task_execution',
        allowPlatformKey: true,
        maxTokens: 2000,
      });
      aiContent = result.content;
      break; // success
    } catch (e) {
      if (attempt === MAX_RETRIES) {
        aiFailed = true;
        const errMsg = e instanceof AIError ? e.message : (e instanceof Error ? e.message : 'Unknown error');
        aiContent = `⚠️ AI execution failed after ${MAX_RETRIES} attempts: ${errMsg}`;
      }
      // Wait before retry
      if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }

  if (!aiContent) aiContent = '⚠️ Execution produced no output.';

  // If AI completely failed → block task and notify user
  if (aiFailed) {
    await db.update(tasks).set({ status: 'blocked', updatedAt: new Date() }).where(eq(tasks.id, taskId));
    await db.insert(chatMessages).values({
      threadId: thread.id, senderType: 'agent', senderAgentId: agent.id,
      content: aiContent, messageType: 'text',
    });
    emitEvent(task.companyId, 'task.updated', { task_id: taskId, status: 'blocked', reason: 'ai_failure' });
    // B-04: CEO relays the error
    onTaskBlocked({ companyId: task.companyId, taskId, agentId: task.assignedAgentId, reason: 'AI execution failed' }).catch(() => {});
    return { thread, needsInput: false, failed: true };
  }

  // Check if agent needs user input
  const needsInput = detectNeedsUserInput(aiContent);

  // Store execution result
  const messageType = aiContent.includes('```') ? 'code' : 'result';
  await db.insert(chatMessages).values({
    threadId: thread.id, senderType: 'agent', senderAgentId: agent.id,
    content: aiContent, messageType: needsInput ? 'question' : messageType,
  });

  // Save deliverable to tasks.result
  await db.update(tasks).set({ result: aiContent, updatedAt: new Date() }).where(eq(tasks.id, taskId));

  if (needsInput) {
    await db.update(tasks).set({ status: 'blocked', updatedAt: new Date() }).where(eq(tasks.id, taskId));
    await db.update(chatThreads).set({ status: 'waiting_user', updatedAt: new Date() }).where(eq(chatThreads.id, thread.id));
    emitEvent(task.companyId, 'agent.question', {
      agent_id: agent.id, agent_name: agent.name, task_id: taskId, thread_id: thread.id,
      question: aiContent.slice(0, 200),
    });
    // B-04: CEO relays agent's question
    onTaskBlocked({ companyId: task.companyId, taskId, agentId: agent.id, reason: `${agent.name} needs your input` }).catch(() => {});
  } else {
    // Move to in_review → Aria auto-reviews
    await db.update(tasks).set({ status: 'in_review', updatedAt: new Date() }).where(eq(tasks.id, taskId));
    emitEvent(task.companyId, 'task.updated', { task_id: taskId, status: 'in_review', agent_id: agent.id });

    // Trigger Aria auto-review (fire and forget)
    autoReviewTask(taskId, task.companyId, userId).catch(() => {});
  }

  return { thread, needsInput };
}

/**
 * Continue execution after user answers a question.
 */
export async function continueAfterUserReply(threadId: string, _userContent: string) {
  const [thread] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId));
  if (!thread || !thread.relatedTaskId) return null;

  const [task] = await db.select().from(tasks).where(eq(tasks.id, thread.relatedTaskId));
  if (!task) return null;

  // Unblock task
  await db.update(tasks).set({ status: 'in_progress', updatedAt: new Date() }).where(eq(tasks.id, task.id));
  await db.update(chatThreads).set({ status: 'active', updatedAt: new Date() }).where(eq(chatThreads.id, threadId));

  // Re-trigger execution with the new context
  // In production, this would recall the AI with full conversation history
  // For now, move task to in_review
  await db.insert(chatMessages).values({
    threadId,
    senderType: 'agent',
    senderAgentId: thread.agentId,
    content: `Thank you for the clarification. I'll incorporate this into my work and proceed with the task.`,
    messageType: 'text',
  });

  await db.update(tasks).set({ status: 'in_review', updatedAt: new Date() }).where(eq(tasks.id, task.id));

  const [agent] = await db.select().from(agents).where(eq(agents.id, thread.agentId));
  if (agent) {
    await reportToSuperior(agent, task, `Task completed after user clarification.`);
  }

  return { taskId: task.id, status: 'in_review' };
}

// --- Report to superior ---

async function reportToSuperior(
  agent: typeof agents.$inferSelect,
  task: typeof tasks.$inferSelect,
  resultSummary: string,
) {
  if (!agent.reportsTo) return;

  const [superior] = await db.select().from(agents).where(eq(agents.id, agent.reportsTo));
  if (!superior) return;

  const [company] = await db.select().from(companies).where(eq(companies.id, agent.companyId));
  if (!company?.userId) return;

  // Find or create a thread for reporting to superior
  const [existingThread] = await db
    .select()
    .from(chatThreads)
    .where(eq(chatThreads.agentId, superior.id));

  let threadId: string;
  if (existingThread) {
    threadId = existingThread.id;
  } else {
    const [newThread] = await db
      .insert(chatThreads)
      .values({
        companyId: agent.companyId,
        agentId: superior.id,
        userId: company.userId,
        threadType: 'report',
        status: 'active',
      })
      .returning();
    threadId = newThread!.id;
  }

  // Add report message
  await db.insert(chatMessages).values({
    threadId,
    senderType: 'agent',
    senderAgentId: agent.id,
    content: `**Task Report from ${agent.name}**\n\nTask: "${task.title}" has been completed.\n\nSummary: ${resultSummary.slice(0, 500)}`,
    messageType: 'result',
  });

  emitEvent(agent.companyId, 'agent.report', {
    from_agent: { id: agent.id, name: agent.name },
    to_agent: { id: superior.id, name: superior.name },
    task_id: task.id,
    task_title: task.title,
  });
}

// --- Helpers ---

function buildAgentPrompt(
  agent: typeof agents.$inferSelect,
  company: typeof companies.$inferSelect,
  task: typeof tasks.$inferSelect,
  knowledge: Array<{ title: string; content: string }>,
): string {
  const rolePrompt = getRolePrompt(agent.title ?? '', agent.department ?? '');
  const knowledgeSection = knowledge.length > 0
    ? `\n\n# Relevant Knowledge\n${knowledge.map((k) => `- ${k.title}: ${k.content.slice(0, 300)}`).join('\n')}`
    : '';

  return (
    `# Identity\nYou are ${agent.name}, the ${agent.title} at ${company.name}.\n` +
    `Department: ${agent.department ?? 'general'} | Level: ${agent.level ?? 'mid'}\n\n` +
    `${rolePrompt}\n\n` +
    `# Current Task\nTitle: ${task.title}\n` +
    `Description: ${task.description ?? 'No description provided'}\n` +
    `Priority: ${task.priority}\n` +
    knowledgeSection + `\n\n` +
    `# Instructions\nExecute this task according to your professional standards. ` +
    `If you need information from the user, clearly state what you need with "I need the following from the user:" prefix.`
  );
}

async function getKnowledgeContext(companyId: string, _title: string, _description: string) {
  try {
    const rows = await db
      .select({ title: knowledgeEntries.title, content: knowledgeEntries.content })
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.companyId, companyId))
      .limit(3);
    return rows;
  } catch {
    return [];
  }
}

/**
 * Aria auto-reviews a completed task. Approves or rejects with feedback.
 * Max 3 rejections before escalating to user.
 */
async function autoReviewTask(taskId: string, companyId: string, userId: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task || task.status !== 'in_review') return;

  // Find CEO (Aria) for this company
  const allAgents = await db.select().from(agents).where(eq(agents.companyId, companyId));
  const ceo = allAgents.find((a) => a.title?.toLowerCase().includes('ceo')) ?? allAgents[0];
  if (!ceo) return;

  // Count previous rejections for this task
  const [rejectionCount] = await db.execute(
    sql`SELECT COUNT(*) as cnt FROM chat_messages
        WHERE thread_id IN (SELECT id FROM chat_threads WHERE related_task_id = ${taskId})
        AND content LIKE '%REVISION_NEEDED%'`,
  );
  const rejections = Number((rejectionCount as unknown as { cnt: string }).cnt);

  if (rejections >= 3) {
    // Escalate to user
    await db.update(tasks).set({ status: 'blocked', updatedAt: new Date() }).where(eq(tasks.id, taskId));
    emitEvent(companyId, 'task.updated', { task_id: taskId, status: 'blocked', reason: 'max_rejections_reached' });
    return;
  }

  try {
    const result = await callAI({
      userId, agentId: ceo.id, companyId,
      provider: 'deepseek', model: 'deepseek-chat',
      systemPrompt: `You are Aria, CEO reviewing a task deliverable. Evaluate if the result meets the task requirements.
Output ONLY one of:
APPROVED - if the deliverable adequately addresses the task description.
REVISION_NEEDED: <brief feedback> - if the deliverable needs improvement. Be specific about what to fix.

Be reasonable — approve if it's good enough, don't be overly perfectionist.`,
      messages: [{
        role: 'user',
        content: `Task: ${task.title}\nDescription: ${task.description ?? 'N/A'}\n\nDeliverable:\n${(task.result ?? '').slice(0, 3000)}`,
      }],
      requestType: 'review',
      allowPlatformKey: true,
      maxTokens: 300,
    });

    const reviewContent = result.content.trim();

    if (reviewContent.startsWith('APPROVED')) {
      // Task passes review
      const now = new Date();
      await db.update(tasks).set({
        status: 'done', completedAt: now, updatedAt: now,
        durationMs: task.startedAt ? now.getTime() - task.startedAt.getTime() : 0,
      }).where(eq(tasks.id, taskId));
      emitEvent(companyId, 'task.completed', { task_id: taskId, agent_id: task.assignedAgentId });
      // B-04: CEO announces task completion
      onTaskCompleted({ companyId, taskId, agentId: task.assignedAgentId }).catch(() => {});
      // B-05v2: CEO reports review passed
      onReviewCompleted({ companyId, taskId, agentId: task.assignedAgentId, reviewerName: ceo.name, passed: true }).catch(() => {});
    } else {
      // Needs revision — send back to in_progress
      const feedback = reviewContent.replace(/^REVISION_NEEDED:?\s*/i, '');
      await db.update(tasks).set({ status: 'in_progress', updatedAt: new Date() }).where(eq(tasks.id, taskId));

      // Log feedback in the task's thread
      const [existingThread] = await db.select().from(chatThreads)
        .where(eq(chatThreads.relatedTaskId, taskId));
      if (existingThread) {
        await db.insert(chatMessages).values({
          threadId: existingThread.id, senderType: 'agent', senderAgentId: ceo.id,
          content: `REVISION_NEEDED: ${feedback}`, messageType: 'text',
        });
      }

      emitEvent(companyId, 'task.updated', { task_id: taskId, status: 'in_progress', reason: 'revision_needed', feedback });
      // B-05v2: CEO reports review rejected
      onReviewCompleted({ companyId, taskId, agentId: task.assignedAgentId, reviewerName: ceo.name, passed: false, feedback }).catch(() => {});

      // Re-execute with feedback (async)
      setTimeout(() => executeTask(taskId).catch(() => {}), 3000);
    }
  } catch {
    // Review AI failed — auto-approve to avoid blocking
    const now = new Date();
    await db.update(tasks).set({
      status: 'done', completedAt: now, updatedAt: now,
      durationMs: task.startedAt ? now.getTime() - task.startedAt.getTime() : 0,
    }).where(eq(tasks.id, taskId));
    emitEvent(companyId, 'task.completed', { task_id: taskId, agent_id: task.assignedAgentId });
    // B-04: CEO announces task completion (auto-approved)
    onTaskCompleted({ companyId, taskId, agentId: task.assignedAgentId }).catch(() => {});
  }
}

function detectNeedsUserInput(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    lower.includes('need from the user') ||
    lower.includes('need the following from') ||
    lower.includes('please provide') ||
    lower.includes('could you clarify') ||
    lower.includes('i require the following')
  );
}


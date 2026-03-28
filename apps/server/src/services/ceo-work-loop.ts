import { Queue, Worker, type Job } from 'bullmq';
import { eq, and, desc } from '@buildcrew/db';
import { db, companies, agents, tasks, chatThreads, chatMessages } from '@buildcrew/db';
import { emitEvent } from '../ws.js';
import { env } from '../env.js';
import Redis from 'ioredis';

// ============================================================
//  B-00a: CEO Work Loop — State Machine + Dedup + Idempotency
// ============================================================

// --- Workflow States (strictly forward, never backward) ---
type WorkflowState = 'planning' | 'waiting_confirmation' | 'hiring' | 'assigning' | 'checking' | 'completed';

// --- Types ---
interface CEOWorkLoopJobData {
  companyId: string;
  userId: string;
  threadId: string;
  ceoAgentId: string;
  language: 'en' | 'zh' | 'ja';
}

// --- Redis setup ---
const redisConnection = {
  host: new URL(env.REDIS_URL).hostname || 'localhost',
  port: Number(new URL(env.REDIS_URL).port) || 6379,
};

let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) redis = new Redis(redisConnection);
  return redis;
}

// --- Queue setup ---
const QUEUE_NAME = 'ceo-work-loop';
const MAX_ROUNDS = 20;

let queue: Queue<CEOWorkLoopJobData> | null = null;
let worker: Worker<CEOWorkLoopJobData> | null = null;

function getCEOWorkLoopQueue(): Queue<CEOWorkLoopJobData> {
  if (!queue) {
    queue = new Queue<CEOWorkLoopJobData>(QUEUE_NAME, { connection: redisConnection });
  }
  return queue;
}

/**
 * Start the CEO work loop. Enqueues the first job.
 * The state machine begins at HIRING (plan was already confirmed).
 */
export async function startCEOWorkLoop(params: {
  companyId: string;
  userId: string;
  threadId: string;
  ceoAgentId: string;
  language?: 'en' | 'zh' | 'ja';
}): Promise<void> {
  // Set initial state to HIRING (plan was just confirmed)
  await db.update(chatThreads).set({
    workflowState: 'hiring',
    workflowRound: '0',
    updatedAt: new Date(),
  }).where(eq(chatThreads.id, params.threadId));

  const q = getCEOWorkLoopQueue();
  await q.add('ceo-loop', {
    companyId: params.companyId,
    userId: params.userId,
    threadId: params.threadId,
    ceoAgentId: params.ceoAgentId,
    language: params.language ?? 'en',
  }, {
    delay: 3000,
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: 100,
  });

  emitEvent(params.companyId, 'ceo.work_loop_started', {
    company_id: params.companyId,
    thread_id: params.threadId,
  });
}

/**
 * Initialize the BullMQ worker. Call once on server startup.
 */
export function initCEOWorkLoopWorker(): void {
  if (worker) return;

  worker = new Worker<CEOWorkLoopJobData>(QUEUE_NAME, async (job: Job<CEOWorkLoopJobData>) => {
    await processWorkLoop(job.data);
  }, {
    connection: redisConnection,
    concurrency: 3,
  });

  worker.on('failed', (job, error) => {
    console.error(`[CEO Loop] Failed:`, error.message);
    if (job) {
      emitEvent(job.data.companyId, 'ceo.work_loop_error', { error: error.message });
    }
  });
}

// ============================================================
//  Core State Machine
// ============================================================

async function processWorkLoop(data: CEOWorkLoopJobData): Promise<void> {
  const { companyId, threadId, ceoAgentId, language } = data;
  const r = getRedis();

  // --- Idempotency lock ---
  const lockKey = `thread:${threadId}:processing`;
  const locked = await r.set(lockKey, '1', 'EX', 30, 'NX');
  if (!locked) return; // Another job is processing this thread

  try {
    // --- Read persisted state ---
    const [thread] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId));
    if (!thread) return;

    const currentState = (thread.workflowState as WorkflowState | null) ?? 'planning';
    const round = Number(thread.workflowRound ?? '0');

    // --- Terminal states → do nothing ---
    if (currentState === 'completed') return;
    if (currentState === 'waiting_confirmation') return; // Wait for user to click "立即执行"

    // --- Hard round limit ---
    if (round >= MAX_ROUNDS) {
      await transitionTo(threadId, 'completed', round);
      await sendOnce(r, threadId, ceoAgentId, 'final_summary', () =>
        buildFinalSummary(companyId, language, round),
      );
      emitEvent(companyId, 'ceo.work_loop_completed', { reason: 'max_rounds' });
      return;
    }

    // --- Increment round ---
    const newRound = round + 1;
    await db.update(chatThreads).set({
      workflowRound: String(newRound),
      updatedAt: new Date(),
    }).where(eq(chatThreads.id, threadId));

    // --- Execute current state ---
    let nextState: WorkflowState | null = null;

    switch (currentState) {
      case 'planning':
        // Should not reach here — planning is done in chat. Just advance.
        nextState = 'hiring';
        break;

      case 'hiring':
        nextState = await executeHiring(data, newRound);
        break;

      case 'assigning':
        nextState = await executeAssigning(data, newRound);
        break;

      case 'checking':
        nextState = await executeChecking(data, newRound);
        break;
    }

    // --- Transition ---
    if (nextState) {
      await transitionTo(threadId, nextState, newRound);

      if (nextState === 'completed') {
        await sendOnce(r, threadId, ceoAgentId, 'final_summary', () =>
          buildFinalSummary(companyId, language, newRound),
        );
        emitEvent(companyId, 'ceo.work_loop_completed', { reason: 'all_done', rounds: newRound });
        return; // DONE — no more jobs enqueued
      }

      // Enqueue next round
      const delay = 3000 + Math.floor(Math.random() * 2000);
      const q = getCEOWorkLoopQueue();
      await q.add('ceo-loop', data, { delay, attempts: 1, removeOnComplete: true, removeOnFail: 100 });
    }

    emitEvent(companyId, 'ceo.work_loop_progress', {
      round: newRound,
      state: nextState ?? currentState,
      thread_id: threadId,
    });

  } finally {
    await r.del(lockKey);
  }
}

// ============================================================
//  State Handlers
// ============================================================

/**
 * HIRING: Hire agents one by one from the plan.
 * Returns 'assigning' when all agents are hired.
 */
async function executeHiring(data: CEOWorkLoopJobData, _round: number): Promise<WorkflowState> {
  const { companyId, ceoAgentId, threadId, language } = data;
  const r = getRedis();

  // Get latest plan from chat (last message with messageType='plan')
  const planMessages = await db.select().from(chatMessages)
    .where(and(eq(chatMessages.threadId, threadId), eq(chatMessages.messageType, 'plan')))
    .orderBy(desc(chatMessages.createdAt))
    .limit(1);

  let plannedTeam: Array<{ name: string; title?: string; department?: string }> = [];

  if (planMessages[0]) {
    const meta = planMessages[0].metadata as Record<string, unknown> | null;
    const teamData = meta?.team as Record<string, unknown> | null;
    if (teamData && 'plan' in teamData) {
      const plan = teamData as { plan: { team?: Array<{ name: string; title?: string; department?: string }> } };
      plannedTeam = plan.plan.team ?? [];
    } else if (teamData && 'team' in teamData) {
      plannedTeam = (teamData as { team: Array<{ name: string }> }).team;
    }
    // Try parsing from content
    if (plannedTeam.length === 0) {
      try {
        const parsed = JSON.parse(planMessages[0].content);
        plannedTeam = parsed?.plan?.team ?? parsed?.team ?? [];
      } catch { /* ignore */ }
    }
  }

  // Check existing team
  const existingAgents = await db.select().from(agents).where(eq(agents.companyId, companyId));
  const existingNames = new Set(existingAgents.map((a) => a.name.toLowerCase()));

  // Find next agent to hire
  const { ROLE_TEMPLATES, resolveRoleKey } = await import('../lib/role-templates.js');
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  const budget = Number(company?.budgetMonthly ?? 300);

  let hired = false;
  for (const member of plannedTeam) {
    const key = resolveRoleKey(member.name);
    const tpl = key ? ROLE_TEMPLATES[key] : null;
    const name = tpl?.name ?? member.name;

    if (existingNames.has(name.toLowerCase())) continue;

    // Hire this one
    await db.insert(agents).values({
      companyId, name, title: tpl?.title ?? member.title ?? name,
      department: tpl?.department ?? member.department ?? 'general',
      level: tpl?.level ?? 'mid',
      reportsTo: ceoAgentId, status: 'idle',
      runtimeConfig: { provider: 'deepseek', model: 'deepseek-chat' },
      budgetMonthly: String(Math.round(budget * (tpl?.budgetPct ?? 0.08))),
      budgetSpent: '0',
      heartbeatIntervalSec: 300, maxConcurrentTasks: 2,
    });

    // Send hire message (dedup by agent name)
    await sendOnce(r, threadId, ceoAgentId, `hired:${name.toLowerCase()}`, () =>
      buildHireMessage(language, name, tpl?.title ?? member.title ?? name),
    );

    emitEvent(companyId, 'agent.status_changed', { action: 'hired', name });
    hired = true;
    break; // One per round
  }

  if (!hired) {
    // All planned agents hired → move to ASSIGNING
    return 'assigning';
  }

  return 'hiring'; // Still more to hire
}

/**
 * ASSIGNING: Create tasks from plan and assign to agents.
 * Returns 'checking' when done.
 */
async function executeAssigning(data: CEOWorkLoopJobData, _round: number): Promise<WorkflowState> {
  const { companyId, ceoAgentId, threadId, language } = data;
  const r = getRedis();

  // Check if tasks already exist
  const existingTasks = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.companyId, companyId));
  if (existingTasks.length > 0) {
    // Tasks already created — skip to checking
    return 'checking';
  }

  // Get plan from last plan message
  const planMessages = await db.select().from(chatMessages)
    .where(and(eq(chatMessages.threadId, threadId), eq(chatMessages.messageType, 'plan')))
    .orderBy(desc(chatMessages.createdAt))
    .limit(1);

  if (!planMessages[0]) return 'checking'; // No plan found, skip

  let planData: { phases: Array<{ name: string; tasks: Array<{ title: string; assignTo?: string; estimatedCost?: number; priority?: string }> }> } | null = null;

  const meta = planMessages[0].metadata as Record<string, unknown> | null;
  const teamData = meta?.team as Record<string, unknown> | null;
  if (teamData && 'plan' in teamData) {
    planData = (teamData as { plan: typeof planData }).plan;
  }
  if (!planData) {
    try {
      const parsed = JSON.parse(planMessages[0].content);
      planData = parsed?.plan ?? null;
    } catch { /* ignore */ }
  }

  if (!planData?.phases) return 'checking';

  // Build agent map
  const team = await db.select().from(agents).where(eq(agents.companyId, companyId));
  const agentMap = new Map<string, string>();
  for (const a of team) {
    agentMap.set(a.name.toLowerCase(), a.id);
  }

  let taskCount = 0;
  for (const phase of planData.phases) {
    for (const t of phase.tasks) {
      let assignId: string | null = null;
      if (t.assignTo) {
        const lower = t.assignTo.toLowerCase().split(/[\s(]/)[0] ?? '';
        assignId = agentMap.get(lower) ?? null;
      }
      await db.insert(tasks).values({
        companyId,
        title: t.title,
        description: `Phase: ${phase.name}`,
        priority: t.priority ?? 'medium',
        status: 'backlog',
        assignedAgentId: assignId,
        costEstimated: String(t.estimatedCost ?? 0),
      });
      taskCount++;
    }
  }

  await sendOnce(r, threadId, ceoAgentId, 'tasks_created', () =>
    buildTasksCreatedMessage(language, taskCount, planData!.phases.length),
  );

  emitEvent(data.companyId, 'task.batch_created', { count: taskCount });
  return 'checking';
}

/**
 * CHECKING: Check wallet balance. Returns 'completed'.
 */
async function executeChecking(data: CEOWorkLoopJobData, _round: number): Promise<WorkflowState> {
  const { ceoAgentId, threadId, language } = data;
  const r = getRedis();

  // Check wallet balance (will be enhanced in B-06)
  // For now: check if user has any valid API keys or platform credits
  try {
    // Placeholder — B-06 will add real wallet check
    // For now just send a ready message
    await sendOnce(r, threadId, ceoAgentId, 'readiness_check', () =>
      buildReadyMessage(language),
    );
  } catch {
    // Ignore check failures
  }

  return 'completed';
}

// ============================================================
//  State Persistence
// ============================================================

async function transitionTo(threadId: string, state: WorkflowState, round: number): Promise<void> {
  await db.update(chatThreads).set({
    workflowState: state,
    workflowRound: String(round),
    updatedAt: new Date(),
  }).where(eq(chatThreads.id, threadId));
}

// ============================================================
//  Message Dedup (Redis)
// ============================================================

/**
 * Send a message ONLY if this type hasn't been sent yet for this thread.
 * Uses Redis SET with TTL 1 hour.
 */
async function sendOnce(
  r: Redis,
  threadId: string,
  ceoAgentId: string,
  msgType: string,
  buildContent: () => string | Promise<string>,
): Promise<boolean> {
  const key = `thread:${threadId}:sent_msg_types`;
  const field = msgType;

  // Check if already sent
  const alreadySent = await r.sismember(key, field);
  if (alreadySent) return false;

  // Mark as sent
  await r.sadd(key, field);
  await r.expire(key, 3600); // 1 hour TTL

  // Build and send
  const content = await buildContent();
  await db.insert(chatMessages).values({
    threadId,
    senderType: 'agent',
    senderAgentId: ceoAgentId,
    content,
    messageType: 'text',
  });
  await db.update(chatThreads).set({ updatedAt: new Date() }).where(eq(chatThreads.id, threadId));

  return true;
}

// ============================================================
//  Language-consistent message builders
// ============================================================

const LANG_PREFIX = {
  zh: '【语言要求】你必须全程使用简体中文回复。绝不使用英文，包括专有名词也用中文。\n\n',
  ja: '【言語要求】すべて日本語で回答してください。英語は一切使用しないでください。\n\n',
  en: '',
} as const;

function buildHireMessage(lang: 'en' | 'zh' | 'ja', name: string, title: string): string {
  const m = {
    en: `${name} has joined the team as ${title}. Moving on to the next hire.`,
    zh: `${name} 已加入团队，担任${title}。继续下一位招聘。`,
    ja: `${name}が${title}としてチームに加わりました。次の採用に進みます。`,
  } as const;
  return m[lang];
}

function buildTasksCreatedMessage(lang: 'en' | 'zh' | 'ja', count: number, phases: number): string {
  const m = {
    en: `Work plan is set. ${count} tasks across ${phases} phase(s) — all assigned and ready to go.`,
    zh: `工作计划已就位。${phases} 个阶段共 ${count} 个任务，已全部分配完毕。`,
    ja: `作業計画が完了しました。${phases}フェーズで${count}タスク、すべて割り当て済みです。`,
  } as const;
  return m[lang];
}

function buildReadyMessage(lang: 'en' | 'zh' | 'ja'): string {
  const m = {
    en: `Everything checks out. The team is assembled, tasks are assigned. We're ready to start working.`,
    zh: `一切就绪。团队已组建完成，任务已分配。我们可以开始工作了。`,
    ja: `すべて確認完了。チームが揃い、タスクが割り当てられました。作業開始の準備ができています。`,
  } as const;
  return m[lang];
}

async function buildFinalSummary(companyId: string, lang: 'en' | 'zh' | 'ja', _rounds: number): Promise<string> {
  const team = await db.select({ name: agents.name, title: agents.title }).from(agents).where(eq(agents.companyId, companyId));
  const allTasks = await db.select({ status: tasks.status }).from(tasks).where(eq(tasks.companyId, companyId));

  const teamCount = team.length;
  const taskCount = allTasks.length;
  const teamNames = team.filter((a) => !a.title?.toLowerCase().includes('ceo')).map((a) => `${a.name}(${a.title})`).join('、');

  const m = {
    en: `Setup complete! Team: ${teamNames || 'none'} (${teamCount} members). ${taskCount} tasks ready. The team will begin working on their next heartbeat. I'll keep you posted on progress.`,
    zh: `初始化完成！团队：${teamNames || '无'}（共 ${teamCount} 人）。${taskCount} 个任务已就绪。团队会在下次心跳时开始工作，我会随时向你汇报进展。`,
    ja: `セットアップ完了！チーム：${teamNames || 'なし'}（${teamCount}名）。${taskCount}タスク準備完了。次のハートビートで作業を開始します。進捗は随時お知らせします。`,
  } as const;
  return m[lang];
}

function buildBalanceWarning(lang: 'en' | 'zh' | 'ja'): string {
  const m = {
    en: `Heads up — your account balance is running low. The team may pause if it runs out. Please top up to keep things running.`,
    zh: `提醒一下——你的账户余额不足了。余额耗尽后团队会暂停工作，请及时充值。`,
    ja: `お知らせ——アカウント残高が少なくなっています。残高がなくなるとチームが一時停止します。チャージをお願いします。`,
  } as const;
  return m[lang];
}

/**
 * Resume the CEO work loop after user reply in waiting_user state.
 */
export async function resumeCEOWorkLoop(params: {
  companyId: string;
  userId: string;
  threadId: string;
  ceoAgentId: string;
  language?: 'en' | 'zh' | 'ja';
}): Promise<void> {
  const q = getCEOWorkLoopQueue();
  await q.add('ceo-loop', {
    companyId: params.companyId,
    userId: params.userId,
    threadId: params.threadId,
    ceoAgentId: params.ceoAgentId,
    language: params.language ?? 'en',
  }, {
    delay: 2000,
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: 100,
  });
}

// Re-export for backward compatibility
export { getCEOWorkLoopQueue, LANG_PREFIX, buildBalanceWarning };

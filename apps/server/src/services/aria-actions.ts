import { eq, and, sql } from '@buildcrew/db';
import { db, tasks, agents } from '@buildcrew/db';

export interface ActionResult {
  executed: boolean;
  action?: string;
  details?: string;
}

/**
 * Detect and execute task management commands from user messages to Aria.
 * Returns what was done so it can be included in Aria's context.
 */
export async function detectAndExecuteAction(
  companyId: string,
  userMessage: string,
): Promise<ActionResult> {
  const lower = userMessage.toLowerCase();

  // Detect "pause X's task" / "暂停某某的任务"
  const pauseMatch = lower.match(/(?:pause|暂停|stop|停止)\s*(.+?)(?:的|'s)?\s*(?:task|任务|工作)/);
  if (pauseMatch) {
    const agentName = pauseMatch[1]?.trim();
    if (agentName) return await pauseAgentTask(companyId, agentName);
  }

  // Detect "reassign X's task to Y" / "把某某的任务交给某某"
  const reassignMatch = lower.match(/(?:reassign|重新分配|交给|转给)\s*(.+?)(?:的|'s)?\s*(?:task|任务).+?(?:to|给)\s*(.+)/);
  if (reassignMatch) {
    const fromName = reassignMatch[1]?.trim();
    const toName = reassignMatch[2]?.trim();
    if (fromName && toName) return await reassignTask(companyId, fromName, toName);
  }

  // Detect "prioritize X" / "优先做某某" / "提高某某优先级"
  const prioritizeMatch = lower.match(/(?:prioritize|优先|提高.{0,4}优先级|urgent|紧急)\s*[：:]?\s*(.+?)(?:的任务|task)?$/);
  if (prioritizeMatch) {
    const taskTitle = prioritizeMatch[1]?.trim();
    if (taskTitle) return await prioritizeTask(companyId, taskTitle);
  }

  // Detect "change direction" / "调整方向" / "pivot"
  if (lower.includes('调整方向') || lower.includes('change direction') || lower.includes('pivot')) {
    return { executed: true, action: 'direction_change_requested', details: 'User wants to change direction. Aria should ask for details.' };
  }

  return { executed: false };
}

async function pauseAgentTask(companyId: string, agentName: string): Promise<ActionResult> {
  // Find agent by name (fuzzy)
  const allAgents = await db.select().from(agents).where(eq(agents.companyId, companyId));
  const agent = allAgents.find((a) => a.name.toLowerCase().includes(agentName.toLowerCase()));
  if (!agent) return { executed: false };

  // Find their in_progress tasks
  const [task] = await db.select().from(tasks).where(
    and(eq(tasks.assignedAgentId, agent.id), eq(tasks.status, 'in_progress')),
  );
  if (!task) return { executed: true, action: 'pause_task', details: `${agent.name} has no active tasks to pause.` };

  await db.update(tasks).set({ status: 'backlog', statusChangedAt: new Date(), updatedAt: new Date() }).where(eq(tasks.id, task.id));
  return { executed: true, action: 'pause_task', details: `Paused "${task.title}" (was assigned to ${agent.name}), moved back to backlog.` };
}

async function reassignTask(companyId: string, fromName: string, toName: string): Promise<ActionResult> {
  const allAgents = await db.select().from(agents).where(eq(agents.companyId, companyId));
  const fromAgent = allAgents.find((a) => a.name.toLowerCase().includes(fromName.toLowerCase()));
  const toAgent = allAgents.find((a) => a.name.toLowerCase().includes(toName.toLowerCase()));

  if (!fromAgent) return { executed: false };
  if (!toAgent) return { executed: true, action: 'reassign', details: `Could not find agent "${toName}" to reassign to.` };

  const [task] = await db.select().from(tasks).where(
    and(eq(tasks.assignedAgentId, fromAgent.id), sql`${tasks.status} IN ('in_progress', 'backlog')`),
  );
  if (!task) return { executed: true, action: 'reassign', details: `${fromAgent.name} has no active tasks to reassign.` };

  await db.update(tasks).set({ assignedAgentId: toAgent.id, statusChangedAt: new Date(), updatedAt: new Date() }).where(eq(tasks.id, task.id));
  return { executed: true, action: 'reassign', details: `Reassigned "${task.title}" from ${fromAgent.name} to ${toAgent.name}.` };
}

async function prioritizeTask(companyId: string, taskTitle: string): Promise<ActionResult> {
  // Fuzzy match by title
  const [task] = await db.execute(
    sql`SELECT id, title FROM tasks WHERE company_id = ${companyId} AND LOWER(title) LIKE ${'%' + taskTitle.toLowerCase() + '%'} LIMIT 1`,
  );
  if (!task) return { executed: false };
  const t = task as unknown as { id: string; title: string };

  await db.update(tasks).set({ priority: 'critical', statusChangedAt: new Date(), updatedAt: new Date() }).where(eq(tasks.id, t.id));
  return { executed: true, action: 'prioritize', details: `Set "${t.title}" to critical priority.` };
}

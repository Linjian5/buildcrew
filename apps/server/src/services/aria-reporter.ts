import { eq, and, sql } from '@buildcrew/db';
import { db, companies, chatThreads, chatMessages } from '@buildcrew/db';
import { emitEvent } from '../ws.js';

// Track last report time per company (in-memory, resets on restart)
const lastReportTime = new Map<string, Date>();

/**
 * Check for task status changes since last report and have Aria summarize them.
 * Called from heartbeat when the CEO agent pings.
 */
export async function checkAndReport(companyId: string, ceoAgentId: string) {
  const lastReport = lastReportTime.get(companyId) ?? new Date(Date.now() - 3600000); // default: 1 hour ago

  // Find tasks with status changes since last report
  const changedTasks = await db.execute(
    sql`SELECT t.id, t.title, t.status, t.assigned_agent_id, a.name as agent_name
        FROM tasks t
        LEFT JOIN agents a ON a.id = t.assigned_agent_id
        WHERE t.company_id = ${companyId}
        AND t.status_changed_at > ${lastReport}
        ORDER BY t.status_changed_at DESC
        LIMIT 10`,
  );

  const changes = changedTasks as unknown as Array<{
    id: string; title: string; status: string; assigned_agent_id: string | null; agent_name: string | null;
  }>;

  if (changes.length === 0) return null; // No changes, no report needed

  // Build change summary
  const summaryLines: string[] = [];
  for (const c of changes) {
    const agent = c.agent_name ?? 'Unassigned';
    if (c.status === 'done') summaryLines.push(`✅ ${agent} completed "${c.title}"`);
    else if (c.status === 'blocked') summaryLines.push(`🚫 ${agent}'s task "${c.title}" is blocked`);
    else if (c.status === 'in_review') summaryLines.push(`📋 ${agent} submitted "${c.title}" for review`);
    else if (c.status === 'in_progress') summaryLines.push(`🔄 "${c.title}" is back in progress (assigned to ${agent})`);
  }

  if (summaryLines.length === 0) return null;

  // Find or create the CEO's report thread with the user
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  if (!company?.userId) return null;

  let threadId: string;
  const [existingThread] = await db.select().from(chatThreads).where(
    and(
      eq(chatThreads.companyId, companyId),
      eq(chatThreads.agentId, ceoAgentId),
      eq(chatThreads.threadType, 'report'),
    ),
  );

  if (existingThread) {
    threadId = existingThread.id;
  } else {
    const [newThread] = await db.insert(chatThreads).values({
      companyId, agentId: ceoAgentId, userId: company.userId,
      threadType: 'report', status: 'active',
    }).returning();
    if (!newThread) return null;
    threadId = newThread.id;
  }

  // Post the summary as a message from Aria
  const reportContent = `📊 **Status Update**\n\n${summaryLines.join('\n')}\n\nTotal changes: ${changes.length} task(s) since last update.`;

  await db.insert(chatMessages).values({
    threadId, senderType: 'agent', senderAgentId: ceoAgentId,
    content: reportContent, messageType: 'result',
  });

  // Update last report time
  lastReportTime.set(companyId, new Date());

  // WebSocket push
  emitEvent(companyId, 'agent.report', {
    from_agent: ceoAgentId,
    type: 'status_update',
    changes: changes.length,
    summary: reportContent,
  });

  return { threadId, changes: changes.length };
}

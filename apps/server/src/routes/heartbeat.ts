import { Router } from 'express';
import { z } from 'zod';
import { eq, and, sql } from '@buildcrew/db';
import { db } from '@buildcrew/db';
import { agents, tasks, companies, usageRecords, chatThreads } from '@buildcrew/db';
import { validate } from '../lib/validate.js';
import { ok, notFound } from '../lib/response.js';
import { param } from '../lib/params.js';
import { executeTask } from '../services/agent-executor.js';
import { checkAndReport } from '../services/aria-reporter.js';
import { emitEvent } from '../ws.js';
import { onBudgetThreshold } from '../services/ceo-operations.js';

const router = Router();

const heartbeatSchema = z.object({
  agent_id: z.string().uuid(),
  status: z.enum(['idle', 'working']),
  current_task_id: z.string().uuid().nullable(),
  token_usage: z.object({
    prompt_tokens: z.number().int().min(0),
    completion_tokens: z.number().int().min(0),
    cost_usd: z.number().min(0),
  }),
});

router.post(
  '/companies/:companyId/agents/:agentId/heartbeat',
  validate(heartbeatSchema),
  async (req, res, next) => {
    try {
      const companyId = param(req, 'companyId');
      const agentId = param(req, 'agentId');
      const body = req.body as z.infer<typeof heartbeatSchema>;

      // Verify agent exists and belongs to company
      const [agent] = await db
        .select()
        .from(agents)
        .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)));

      if (!agent) return notFound(res, 'Agent');

      // Accumulate token cost atomically
      const budgetMonthly = Number(agent.budgetMonthly);

      const [updatedAgent] = await db.execute(
        sql`UPDATE agents
            SET budget_spent = budget_spent::numeric + ${body.token_usage.cost_usd},
                last_heartbeat_at = NOW(),
                status = ${body.status},
                updated_at = NOW()
            WHERE id = ${agentId}
            RETURNING budget_spent`,
      );

      const newBudgetSpent = Number((updatedAgent as unknown as { budget_spent: string }).budget_spent);

      // Record usage
      if (body.token_usage.cost_usd > 0 || body.token_usage.prompt_tokens > 0) {
        const runtimeConfig = agent.runtimeConfig as { provider?: string; model?: string } | null;
        const provider = runtimeConfig?.provider ?? 'unknown';
        const model = runtimeConfig?.model ?? 'unknown';
        const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
        if (company?.userId) {
          await db.insert(usageRecords).values({
            userId: company.userId,
            companyId, agentId,
            taskId: body.current_task_id,
            provider, model,
            promptTokens: body.token_usage.prompt_tokens,
            completionTokens: body.token_usage.completion_tokens,
            totalTokens: body.token_usage.prompt_tokens + body.token_usage.completion_tokens,
            costUsd: String(body.token_usage.cost_usd),
            requestType: 'heartbeat',
          }).catch(() => {});
        }
      }

      // B-05v2: Check budget thresholds (50%, 80%)
      if (budgetMonthly > 0) {
        // Get total company budget
        const allCompanyAgents = await db.select({ budgetSpent: agents.budgetSpent }).from(agents).where(eq(agents.companyId, companyId));
        const totalCompanySpent = allCompanyAgents.reduce((sum, a) => sum + Number(a.budgetSpent ?? 0), 0);
        const [companyRow] = await db.select({ budgetMonthly: companies.budgetMonthly }).from(companies).where(eq(companies.id, companyId));
        const companyBudget = Number(companyRow?.budgetMonthly ?? 0);
        if (companyBudget > 0) {
          const pct = (totalCompanySpent / companyBudget) * 100;
          if (pct >= 50) {
            onBudgetThreshold({ companyId, budgetPct: pct, budgetSpent: totalCompanySpent, budgetMonthly: companyBudget }).catch(() => {});
          }
        }
      }

      // --- CEO auto-report on status changes ---
      if (agent.title?.toLowerCase().includes('ceo')) {
        checkAndReport(companyId, agentId).catch(() => {});
      }

      // --- Autonomous work cycle ---

      // 1. Paused → stop
      if (agent.status === 'paused') {
        return ok(res, { action: 'pause', task: null, thread_id: null, pending_questions: [], knowledge_context: [], message: 'Agent is paused' });
      }

      // 2. Budget exhausted → stop
      if (newBudgetSpent >= budgetMonthly && budgetMonthly > 0) {
        await db.update(agents).set({ status: 'paused', updatedAt: new Date() }).where(eq(agents.id, agentId));
        return ok(res, { action: 'stop', task: null, thread_id: null, pending_questions: [], knowledge_context: [], message: 'Budget exhausted' });
      }

      // 3. Check for pending user questions (waiting_user threads)
      const [pendingQuestion] = await db
        .select()
        .from(chatThreads)
        .where(and(eq(chatThreads.agentId, agentId), eq(chatThreads.status, 'waiting_user')));

      if (pendingQuestion) {
        return ok(res, {
          action: 'wait_user',
          task: null,
          thread_id: pendingQuestion.id,
          pending_questions: [{ thread_id: pendingQuestion.id, thread_type: pendingQuestion.threadType, related_task_id: pendingQuestion.relatedTaskId }],
          knowledge_context: [],
          message: 'Waiting for user response',
        });
      }

      // 4. If working on a current task → continue
      if (body.status === 'working' && body.current_task_id) {
        const [currentTask] = await db.select().from(tasks).where(eq(tasks.id, body.current_task_id));
        if (currentTask && currentTask.status === 'in_progress') {
          return ok(res, {
            action: 'continue_task',
            task: { id: currentTask.id, title: currentTask.title, description: currentTask.description, priority: currentTask.priority, cost_estimated: Number(currentTask.costEstimated) },
            thread_id: null,
            pending_questions: [],
            knowledge_context: [],
            message: null,
          });
        }
      }

      // 5. Check for assigned but not-yet-started tasks
      const [assignedTask] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.assignedAgentId, agentId), eq(tasks.status, 'in_progress')))
        .limit(1);

      if (assignedTask) {
        // Trigger execution (fire and forget)
        executeTask(assignedTask.id).catch(() => {});

        emitEvent(companyId, 'agent.task_started', { agent_id: agentId, task_id: assignedTask.id, task_title: assignedTask.title });

        return ok(res, {
          action: 'execute_task',
          task: { id: assignedTask.id, title: assignedTask.title, description: assignedTask.description, priority: assignedTask.priority, cost_estimated: Number(assignedTask.costEstimated) },
          thread_id: null,
          pending_questions: [],
          knowledge_context: [],
          message: 'Executing task',
        });
      }

      // 6. Try to pick up a new task (atomic checkout)
      const newTask = await db.transaction(async (tx) => {
        const [availableTask] = await tx.execute(
          sql`SELECT * FROM tasks
              WHERE company_id = ${companyId}
              AND status = 'backlog'
              AND assigned_agent_id IS NULL
              ORDER BY
                CASE priority
                  WHEN 'critical' THEN 0
                  WHEN 'high' THEN 1
                  WHEN 'medium' THEN 2
                  WHEN 'low' THEN 3
                END,
                created_at ASC
              LIMIT 1
              FOR UPDATE SKIP LOCKED`,
        );

        if (!availableTask) return null;
        const taskRow = availableTask as unknown as { id: string };

        const [updated] = await tx
          .update(tasks)
          .set({ assignedAgentId: agentId, status: 'in_progress', startedAt: new Date(), updatedAt: new Date() })
          .where(eq(tasks.id, taskRow.id))
          .returning();

        return updated ?? null;
      });

      if (newTask) {
        // Inject knowledge context
        let knowledgeContext: Array<{ id: string; title: string; content: string; category: string }> = [];
        try {
          const knowledgeRows = await db.execute(
            sql`SELECT id, title, content, category FROM knowledge_entries
                WHERE company_id = ${companyId} AND expired = false AND embedding IS NOT NULL
                ORDER BY RANDOM() LIMIT 3`,
          );
          knowledgeContext = knowledgeRows as unknown as typeof knowledgeContext;
          for (const k of knowledgeContext) {
            await db.execute(sql`UPDATE knowledge_entries SET citation_count = citation_count + 1 WHERE id = ${k.id}`);
          }
        } catch {}

        // Trigger autonomous execution
        executeTask(newTask.id).catch(() => {});
        emitEvent(companyId, 'agent.task_started', { agent_id: agentId, task_id: newTask.id, task_title: newTask.title });

        return ok(res, {
          action: 'execute_task',
          task: { id: newTask.id, title: newTask.title, description: newTask.description, priority: newTask.priority, cost_estimated: Number(newTask.costEstimated) },
          thread_id: null,
          pending_questions: [],
          knowledge_context: knowledgeContext,
          message: null,
        });
      }

      // 7. Nothing to do → idle
      ok(res, { action: 'idle', task: null, thread_id: null, pending_questions: [], knowledge_context: [], message: 'No tasks available' });
    } catch (e) {
      next(e);
    }
  },
);

export { router as heartbeatRouter };

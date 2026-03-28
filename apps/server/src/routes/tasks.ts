import { Router } from 'express';
import { z } from 'zod';
import { eq, and, count, sql } from '@buildcrew/db';
import { db } from '@buildcrew/db';
import { tasks, agents } from '@buildcrew/db';
import { validate, parsePagination } from '../lib/validate.js';
import { ok, paginated, notFound, err } from '../lib/response.js';
import { param } from '../lib/params.js';
import { scoreCompletedTask } from '../engines/evolution.js';
import { validateCompanyOwnership } from '../middleware/company-ownership.js';
import { onTaskCompleted } from '../services/ceo-operations.js';

const router = Router();

// --- State Machine ---

const VALID_TRANSITIONS: Record<string, string[]> = {
  backlog: ['in_progress', 'blocked'],
  in_progress: ['in_review', 'blocked'],
  in_review: ['done', 'in_progress', 'blocked'],
  done: [],
  blocked: ['backlog'],
};

export function canTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// --- Schemas ---

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  goal_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  assigned_agent_id: z.string().uuid().nullable().optional(),
  estimated_cost: z.number().min(0).default(0),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assigned_agent_id: z.string().uuid().nullable().optional(),
  goal_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
});

// --- Routes ---

// POST /companies/:companyId/tasks — Create
router.post(
  '/companies/:companyId/tasks',
  validateCompanyOwnership,
  validate(createTaskSchema),
  async (req, res, next) => {
    try {
      const companyId = param(req, 'companyId');
      const body = req.body as z.infer<typeof createTaskSchema>;

      const [task] = await db
        .insert(tasks)
        .values({
          companyId,
          title: body.title,
          description: body.description,
          priority: body.priority,
          goalId: body.goal_id,
          projectId: body.project_id,
          assignedAgentId: body.assigned_agent_id ?? null,
          costEstimated: String(body.estimated_cost),
          status: 'backlog',
        })
        .returning();

      ok(res, formatTask(task!), 201);
    } catch (e) {
      next(e);
    }
  },
);

// GET /companies/:companyId/tasks — List (paginated, filterable)
router.get('/companies/:companyId/tasks', validateCompanyOwnership, async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const offset = (page - 1) * limit;

    const conditions = [eq(tasks.companyId, companyId)];
    const status = req.query['status'] as string | undefined;
    const agentId = req.query['agent_id'] as string | undefined;
    const priority = req.query['priority'] as string | undefined;
    if (status) conditions.push(eq(tasks.status, status));
    if (agentId) conditions.push(eq(tasks.assignedAgentId, agentId));
    if (priority) conditions.push(eq(tasks.priority, priority));

    const where = and(...conditions);

    const [rows, [countRow]] = await Promise.all([
      db.select().from(tasks).where(where).limit(limit).offset(offset).orderBy(tasks.createdAt),
      db.select({ total: count() }).from(tasks).where(where),
    ]);

    const total = countRow?.total ?? 0;
    paginated(res, rows.map(formatTask), { page, limit, total: Number(total) });
  } catch (e) {
    next(e);
  }
});

// GET /companies/:companyId/tasks/:id — Detail
router.get('/companies/:companyId/tasks/:id', validateCompanyOwnership, async (req, res, next) => {
  try {
    const task = await findTask(param(req, 'companyId'), param(req, 'id'));
    if (!task) return notFound(res, 'Task');
    ok(res, formatTask(task));
  } catch (e) {
    next(e);
  }
});

// PUT /companies/:companyId/tasks/:id — Update
router.put(
  '/companies/:companyId/tasks/:id',
  validateCompanyOwnership,
  validate(updateTaskSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof updateTaskSchema>;
      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (body.title !== undefined) updates['title'] = body.title;
      if (body.description !== undefined) updates['description'] = body.description;
      if (body.priority !== undefined) updates['priority'] = body.priority;
      if (body.assigned_agent_id !== undefined) updates['assignedAgentId'] = body.assigned_agent_id;
      if (body.goal_id !== undefined) updates['goalId'] = body.goal_id;
      if (body.project_id !== undefined) updates['projectId'] = body.project_id;

      const [task] = await db
        .update(tasks)
        .set(updates)
        .where(and(eq(tasks.id, param(req, 'id')), eq(tasks.companyId, param(req, 'companyId'))))
        .returning();

      if (!task) return notFound(res, 'Task');
      ok(res, formatTask(task));
    } catch (e) {
      next(e);
    }
  },
);

// POST /companies/:companyId/tasks/:id/assign — Assign to agent
router.post('/companies/:companyId/tasks/:id/assign', validateCompanyOwnership, async (req, res, next) => {
  try {
    const { agent_id } = req.body as { agent_id: string };
    if (!agent_id) return err(res, 400, 'VALIDATION_ERROR', 'agent_id is required');

    const task = await findTask(param(req, 'companyId'), param(req, 'id'));
    if (!task) return notFound(res, 'Task');

    // Verify agent exists in same company
    const [agent] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.id, agent_id), eq(agents.companyId, param(req, 'companyId'))));
    if (!agent) return notFound(res, 'Agent');

    if (task.status !== 'backlog') {
      return err(res, 400, 'INVALID_TRANSITION', `Cannot assign task in '${task.status}' status`);
    }

    const [updated] = await db
      .update(tasks)
      .set({
        assignedAgentId: agent_id,
        status: 'in_progress',
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, task.id))
      .returning();

    ok(res, formatTask(updated!));
  } catch (e) {
    next(e);
  }
});

// POST /companies/:companyId/tasks/:id/checkout — Atomic checkout
router.post('/companies/:companyId/tasks/:id/checkout', validateCompanyOwnership, async (req, res, next) => {
  try {
    const { agent_id } = req.body as { agent_id: string };
    if (!agent_id) return err(res, 400, 'VALIDATION_ERROR', 'agent_id is required');

    const companyId = param(req, 'companyId');
    const taskId = param(req, 'id');

    // Atomic checkout using SELECT FOR UPDATE within a transaction
    const result = await db.transaction(async (tx) => {
      // Lock the task row
      const [lockedTask] = await tx.execute(
        sql`SELECT * FROM tasks WHERE id = ${taskId} AND company_id = ${companyId} FOR UPDATE`,
      );

      if (!lockedTask) return { error: 'NOT_FOUND' as const };

      const taskRow = lockedTask as unknown as { status: string; assigned_agent_id: string | null };

      if (taskRow.status !== 'backlog') {
        return { error: 'CONFLICT' as const, status: taskRow.status };
      }

      // Verify agent belongs to company
      const [agent] = await tx
        .select({ id: agents.id })
        .from(agents)
        .where(and(eq(agents.id, agent_id), eq(agents.companyId, companyId)));
      if (!agent) return { error: 'AGENT_NOT_FOUND' as const };

      const [updated] = await tx
        .update(tasks)
        .set({
          assignedAgentId: agent_id,
          status: 'in_progress',
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId))
        .returning();

      return { task: updated! };
    });

    if ('error' in result) {
      if (result.error === 'NOT_FOUND') return notFound(res, 'Task');
      if (result.error === 'AGENT_NOT_FOUND') return notFound(res, 'Agent');
      return err(res, 409, 'CONFLICT', `Task is already in '${result.status}' status`);
    }

    ok(res, formatTask(result.task));
  } catch (e) {
    next(e);
  }
});

// POST /companies/:companyId/tasks/:id/complete — Complete task
router.post('/companies/:companyId/tasks/:id/complete', validateCompanyOwnership, async (req, res, next) => {
  try {
    const task = await findTask(param(req, 'companyId'), param(req, 'id'));
    if (!task) return notFound(res, 'Task');

    // Allow in_progress → in_review → done, or direct in_review → done
    if (task.status !== 'in_review' && task.status !== 'in_progress') {
      return err(
        res,
        400,
        'INVALID_TRANSITION',
        `Cannot complete task in '${task.status}' status`,
      );
    }

    const now = new Date();
    const durationMs = task.startedAt ? now.getTime() - task.startedAt.getTime() : 0;

    const [updated] = await db
      .update(tasks)
      .set({
        status: 'done',
        completedAt: now,
        durationMs,
        updatedAt: now,
      })
      .where(eq(tasks.id, task.id))
      .returning();

    // Trigger auto-scoring (fire and forget)
    scoreCompletedTask(updated!.id).catch(() => { /* scoring failure should not block response */ });

    // B-04: CEO reports task completion
    onTaskCompleted({ companyId: task.companyId, taskId: task.id, agentId: task.assignedAgentId }).catch(() => {});

    ok(res, formatTask(updated!));
  } catch (e) {
    next(e);
  }
});

// --- Helpers ---

async function findTask(companyId: string, taskId: string) {
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.companyId, companyId)));
  return task ?? null;
}

type TaskRow = typeof tasks.$inferSelect;

function formatTask(row: TaskRow) {
  return {
    id: row.id,
    company_id: row.companyId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assigned_agent_id: row.assignedAgentId,
    goal_id: row.goalId,
    project_id: row.projectId,
    goal_ancestry: [] as string[],
    cost_actual: Number(row.costActual),
    cost_estimated: Number(row.costEstimated),
    duration_ms: Number(row.durationMs),
    score: row.score as { overall: number; correctness: number; code_quality: number; efficiency: number; cost_efficiency: number } | null,
    started_at: row.startedAt?.toISOString() ?? null,
    completed_at: row.completedAt?.toISOString() ?? null,
    created_at: row.createdAt?.toISOString() ?? null,
    updated_at: row.updatedAt?.toISOString() ?? null,
  };
}

export { router as tasksRouter };

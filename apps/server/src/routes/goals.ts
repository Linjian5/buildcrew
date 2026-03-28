import { Router } from 'express';
import { z } from 'zod';
import { eq, and, count, sql } from '@buildcrew/db';
import { db } from '@buildcrew/db';
import { goals, projects, tasks } from '@buildcrew/db';
import { validate, parsePagination } from '../lib/validate.js';
import { ok, paginated, notFound } from '../lib/response.js';
import { param } from '../lib/params.js';
import { validateCompanyOwnership } from '../middleware/company-ownership.js';

const router = Router();

// --- Goal Schemas ---

const createGoalSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  parent_goal_id: z.string().uuid().nullable().optional(),
});

const updateGoalSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  parent_goal_id: z.string().uuid().nullable().optional(),
  progress_pct: z.number().min(0).max(100).optional(),
  status: z.enum(['active', 'completed', 'paused']).optional(),
});

// --- Project Schemas ---

const createProjectSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  goal_id: z.string().uuid().optional(),
});

const updateProjectSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  goal_id: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
});

// ========== GOAL ROUTES ==========

router.post('/companies/:companyId/goals', validateCompanyOwnership, validate(createGoalSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createGoalSchema>;
    const [goal] = await db
      .insert(goals)
      .values({
        companyId: param(req, 'companyId'),
        title: body.title,
        description: body.description,
        parentGoalId: body.parent_goal_id ?? null,
      })
      .returning();
    ok(res, formatGoal(goal!), 201);
  } catch (e) {
    next(e);
  }
});

router.get('/companies/:companyId/goals', validateCompanyOwnership, async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const offset = (page - 1) * limit;

    const where = eq(goals.companyId, companyId);
    const [rows, [countRow]] = await Promise.all([
      db.select().from(goals).where(where).limit(limit).offset(offset).orderBy(goals.createdAt),
      db.select({ total: count() }).from(goals).where(where),
    ]);

    // Auto-calculate progress + task counts for each goal
    const data = await Promise.all(rows.map(async (g) => {
      const stats = await calculateGoalStats(g.id);
      return formatGoal({ ...g, progressPct: String(stats.progress) }, stats.taskCount, stats.completedTaskCount);
    }));

    paginated(res, data, { page, limit, total: Number(countRow?.total ?? 0) });
  } catch (e) {
    next(e);
  }
});

router.get('/companies/:companyId/goals/:id', validateCompanyOwnership, async (req, res, next) => {
  try {
    const [goal] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, param(req, 'id')), eq(goals.companyId, param(req, 'companyId'))));
    if (!goal) return notFound(res, 'Goal');

    const stats = await calculateGoalStats(goal.id);
    ok(res, formatGoal({ ...goal, progressPct: String(stats.progress) }, stats.taskCount, stats.completedTaskCount));
  } catch (e) {
    next(e);
  }
});

router.put('/companies/:companyId/goals/:id', validateCompanyOwnership, validate(updateGoalSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof updateGoalSchema>;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) updates['title'] = body.title;
    if (body.description !== undefined) updates['description'] = body.description;
    if (body.parent_goal_id !== undefined) updates['parentGoalId'] = body.parent_goal_id;
    if (body.progress_pct !== undefined) updates['progressPct'] = String(body.progress_pct);
    if (body.status !== undefined) updates['status'] = body.status;

    const [goal] = await db
      .update(goals)
      .set(updates)
      .where(and(eq(goals.id, param(req, 'id')), eq(goals.companyId, param(req, 'companyId'))))
      .returning();
    if (!goal) return notFound(res, 'Goal');
    ok(res, formatGoal(goal));
  } catch (e) {
    next(e);
  }
});

router.delete('/companies/:companyId/goals/:id', validateCompanyOwnership, async (req, res, next) => {
  try {
    const [goal] = await db
      .delete(goals)
      .where(and(eq(goals.id, param(req, 'id')), eq(goals.companyId, param(req, 'companyId'))))
      .returning();
    if (!goal) return notFound(res, 'Goal');
    ok(res, { id: goal.id, deleted: true });
  } catch (e) {
    next(e);
  }
});

// ========== PROJECT ROUTES ==========

router.post('/companies/:companyId/projects', validateCompanyOwnership, validate(createProjectSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createProjectSchema>;
    const [project] = await db
      .insert(projects)
      .values({
        companyId: param(req, 'companyId'),
        title: body.title,
        description: body.description,
        goalId: body.goal_id,
      })
      .returning();
    ok(res, formatProject(project!), 201);
  } catch (e) {
    next(e);
  }
});

router.get('/companies/:companyId/projects', validateCompanyOwnership, async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const offset = (page - 1) * limit;

    const where = eq(projects.companyId, companyId);
    const [rows, [countRow]] = await Promise.all([
      db.select().from(projects).where(where).limit(limit).offset(offset).orderBy(projects.createdAt),
      db.select({ total: count() }).from(projects).where(where),
    ]);

    paginated(res, rows.map(formatProject), { page, limit, total: Number(countRow?.total ?? 0) });
  } catch (e) {
    next(e);
  }
});

router.get('/companies/:companyId/projects/:id', validateCompanyOwnership, async (req, res, next) => {
  try {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, param(req, 'id')), eq(projects.companyId, param(req, 'companyId'))));
    if (!project) return notFound(res, 'Project');
    ok(res, formatProject(project));
  } catch (e) {
    next(e);
  }
});

router.put('/companies/:companyId/projects/:id', validateCompanyOwnership, validate(updateProjectSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof updateProjectSchema>;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) updates['title'] = body.title;
    if (body.description !== undefined) updates['description'] = body.description;
    if (body.goal_id !== undefined) updates['goalId'] = body.goal_id;
    if (body.status !== undefined) updates['status'] = body.status;

    const [project] = await db
      .update(projects)
      .set(updates)
      .where(and(eq(projects.id, param(req, 'id')), eq(projects.companyId, param(req, 'companyId'))))
      .returning();
    if (!project) return notFound(res, 'Project');
    ok(res, formatProject(project));
  } catch (e) {
    next(e);
  }
});

router.delete('/companies/:companyId/projects/:id', validateCompanyOwnership, async (req, res, next) => {
  try {
    const [project] = await db
      .delete(projects)
      .where(and(eq(projects.id, param(req, 'id')), eq(projects.companyId, param(req, 'companyId'))))
      .returning();
    if (!project) return notFound(res, 'Project');
    ok(res, { id: project.id, deleted: true });
  } catch (e) {
    next(e);
  }
});

// --- Helpers ---

async function calculateGoalStats(goalId: string): Promise<{ progress: number; taskCount: number; completedTaskCount: number }> {
  const [result] = await db
    .select({
      total: count(),
      done: count(sql`CASE WHEN ${tasks.status} IN ('completed', 'done') THEN 1 END`),
    })
    .from(tasks)
    .where(eq(tasks.goalId, goalId));

  const total = Number(result?.total ?? 0);
  const done = Number(result?.done ?? 0);
  const progress = total === 0 ? 0 : Math.round((done / total) * 10000) / 100;
  return { progress, taskCount: total, completedTaskCount: done };
}

type GoalRow = typeof goals.$inferSelect;

function formatGoal(row: GoalRow, taskCount = 0, completedTaskCount = 0) {
  return {
    id: row.id,
    company_id: row.companyId,
    parent_goal_id: row.parentGoalId,
    title: row.title,
    description: row.description,
    progress_pct: Number(row.progressPct),
    status: row.status,
    task_count: taskCount,
    completed_task_count: completedTaskCount,
    created_at: row.createdAt?.toISOString() ?? null,
    updated_at: row.updatedAt?.toISOString() ?? null,
  };
}

type ProjectRow = typeof projects.$inferSelect;

function formatProject(row: ProjectRow) {
  return {
    id: row.id,
    company_id: row.companyId,
    goal_id: row.goalId,
    title: row.title,
    description: row.description,
    status: row.status,
    created_at: row.createdAt?.toISOString() ?? null,
    updated_at: row.updatedAt?.toISOString() ?? null,
  };
}

export { router as goalsRouter };

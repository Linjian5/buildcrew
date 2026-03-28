import { Router } from 'express';
import { z } from 'zod';
import { eq, and, count, sql } from '@buildcrew/db';
import { db, agents, agentProfiles, taskScores, experiments, experimentAssignments } from '@buildcrew/db';
import { validate, parsePagination } from '../lib/validate.js';
import { ok, paginated, notFound } from '../lib/response.js';
import { param } from '../lib/params.js';
import { requirePlan } from '../middleware/plan-guard.js';
import { validateCompanyOwnership } from '../middleware/company-ownership.js';

const router = Router();

// GET /companies/:companyId/agents/:agentId/performance
router.get('/companies/:companyId/agents/:agentId/performance', validateCompanyOwnership, async (req, res, next) => {
  try {
    const agentId = param(req, 'agentId');
    const companyId = param(req, 'companyId');

    const [agent] = await db.select().from(agents).where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)));
    if (!agent) return notFound(res, 'Agent');

    const [profile] = await db.select().from(agentProfiles).where(eq(agentProfiles.agentId, agentId));

    // Get recent scores
    const recentScores = await db
      .select()
      .from(taskScores)
      .where(eq(taskScores.agentId, agentId))
      .orderBy(taskScores.createdAt)
      .limit(20);

    // Calculate radar chart data (averages)
    const avgScores = recentScores.length > 0
      ? {
          correctness: avg(recentScores.map((s) => s.correctness)),
          code_quality: avg(recentScores.map((s) => s.codeQuality)),
          efficiency: avg(recentScores.map((s) => s.efficiency)),
          cost_efficiency: avg(recentScores.map((s) => s.costEfficiency)),
        }
      : { correctness: 0, code_quality: 0, efficiency: 0, cost_efficiency: 0 };

    // Determine trend
    const trend = determineTrend(recentScores.map((s) => s.overall));

    ok(res, {
      agent_id: agentId,
      total_tasks: profile?.tasksCompleted ?? 0,
      avg_score: Number(profile?.totalScore ?? 0),
      avg_task_duration_ms: profile?.avgTaskDurationMs ?? 0,
      success_rate: Number(profile?.successRate ?? 0),
      trend,
      radar: avgScores,
      recent_scores: recentScores.map((s) => ({
        task_id: s.taskId,
        overall: s.overall,
        correctness: s.correctness,
        code_quality: s.codeQuality,
        efficiency: s.efficiency,
        cost_efficiency: s.costEfficiency,
        created_at: s.createdAt?.toISOString() ?? null,
      })),
    });
  } catch (e) {
    next(e);
  }
});

// GET /companies/:companyId/experiments — List
router.get('/companies/:companyId/experiments', validateCompanyOwnership, async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const offset = (page - 1) * limit;

    const where = eq(experiments.companyId, companyId);
    const [rows, [countRow]] = await Promise.all([
      db.select().from(experiments).where(where).limit(limit).offset(offset).orderBy(experiments.createdAt),
      db.select({ total: count() }).from(experiments).where(where),
    ]);

    const data = rows.map((e) => ({
      id: e.id,
      company_id: e.companyId,
      name: e.name,
      description: e.description,
      status: e.status,
      config_a: e.configA,
      config_b: e.configB,
      created_at: e.createdAt?.toISOString() ?? null,
    }));

    paginated(res, data, { page, limit, total: Number(countRow?.total ?? 0) });
  } catch (e) {
    next(e);
  }
});

// POST /companies/:companyId/experiments — Create
const createExperimentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  variant_a: z.record(z.string(), z.unknown()),
  variant_b: z.record(z.string(), z.unknown()),
});

router.post('/companies/:companyId/experiments', validateCompanyOwnership, requirePlan('pro'), validate(createExperimentSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createExperimentSchema>;
    const [exp] = await db
      .insert(experiments)
      .values({
        companyId: param(req, 'companyId'),
        name: body.name,
        description: body.description,
        configA: body.variant_a,
        configB: body.variant_b,
      })
      .returning();

    ok(res, {
      id: exp!.id,
      company_id: exp!.companyId,
      name: exp!.name,
      description: exp!.description,
      status: exp!.status,
      config_a: exp!.configA,
      config_b: exp!.configB,
      created_at: exp!.createdAt?.toISOString() ?? null,
    }, 201);
  } catch (e) {
    next(e);
  }
});

// GET /companies/:companyId/experiments/:id/results
router.get('/companies/:companyId/experiments/:id/results', validateCompanyOwnership, async (req, res, next) => {
  try {
    const expId = param(req, 'id');
    const [exp] = await db.select().from(experiments).where(eq(experiments.id, expId));
    if (!exp) return notFound(res, 'Experiment');

    const assignments = await db
      .select()
      .from(experimentAssignments)
      .where(eq(experimentAssignments.experimentId, expId));

    // Get scores for assigned tasks
    const taskIds = assignments.map((a) => a.taskId);
    const scores = taskIds.length > 0
      ? await db.execute(
          sql`SELECT ts.*, ea.variant FROM task_scores ts
              JOIN experiment_assignments ea ON ea.task_id = ts.task_id
              WHERE ea.experiment_id = ${expId}`,
        )
      : [];

    const scoresByVariant = { a: [] as number[], b: [] as number[] };
    for (const s of scores as unknown as Array<{ variant: string; overall: number }>) {
      if (s.variant === 'a') scoresByVariant.a.push(s.overall);
      else scoresByVariant.b.push(s.overall);
    }

    ok(res, {
      experiment_id: expId,
      status: exp.status,
      total_assignments: assignments.length,
      variant_a: { count: scoresByVariant.a.length, avg_score: avg(scoresByVariant.a) },
      variant_b: { count: scoresByVariant.b.length, avg_score: avg(scoresByVariant.b) },
      config_a: exp.configA,
      config_b: exp.configB,
    });
  } catch (e) {
    next(e);
  }
});

// --- Helpers ---

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

function determineTrend(scores: number[]): 'improving' | 'stable' | 'declining' {
  if (scores.length < 3) return 'stable';
  const recent = scores.slice(-3);
  const older = scores.slice(-6, -3);
  if (older.length === 0) return 'stable';
  const recentAvg = avg(recent);
  const olderAvg = avg(older);
  if (recentAvg > olderAvg + 2) return 'improving';
  if (recentAvg < olderAvg - 2) return 'declining';
  return 'stable';
}

export { router as evolutionRouter };

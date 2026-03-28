import { Router } from 'express';
import { z } from 'zod';
import { eq, and, count } from '@buildcrew/db';
import { db } from '@buildcrew/db';
import { agents } from '@buildcrew/db';
import { validate, parsePagination } from '../lib/validate.js';
import { ok, paginated, notFound, err } from '../lib/response.js';
import { param } from '../lib/params.js';
import { checkLimit } from '../middleware/plan-guard.js';
import { validateCompanyOwnership } from '../middleware/company-ownership.js';

const router = Router();

// --- Schemas ---

const runtimeSchema = z.object({
  type: z.string().min(1),
  model: z.string().min(1),
  endpoint: z.string().url(),
});

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  title: z.string().min(1).max(100),
  department: z.string().max(50).optional(),
  level: z.string().max(50).default('junior'),
  reports_to: z.string().uuid().nullable().optional(),
  runtime: runtimeSchema,
  budget_monthly: z.number().min(0).default(0),
  heartbeat_interval_seconds: z.number().int().min(10).max(86400).default(300),
  max_concurrent_tasks: z.number().int().min(1).max(10).default(1),
  role_template_id: z.string().uuid().nullable().optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  title: z.string().min(1).max(100).optional(),
  department: z.string().max(50).optional(),
  level: z.string().max(50).optional(),
  reports_to: z.string().uuid().nullable().optional(),
  runtime: runtimeSchema.optional(),
  budget_monthly: z.number().min(0).optional(),
  heartbeat_interval_seconds: z.number().int().min(10).max(86400).optional(),
  max_concurrent_tasks: z.number().int().min(1).max(10).optional(),
});

// --- Routes ---

// POST /companies/:companyId/agents — Hire
router.post(
  '/companies/:companyId/agents',
  validateCompanyOwnership,
  checkLimit('agents'),
  validate(createAgentSchema),
  async (req, res, next) => {
    try {
      const companyId = param(req, 'companyId');
      const body = req.body as z.infer<typeof createAgentSchema>;

      const [agent] = await db
        .insert(agents)
        .values({
          companyId,
          name: body.name,
          title: body.title,
          department: body.department,
          level: body.level,
          reportsTo: body.reports_to ?? null,
          status: 'idle',
          runtimeConfig: body.runtime,
          budgetMonthly: String(body.budget_monthly),
          budgetSpent: '0',
          heartbeatIntervalSec: body.heartbeat_interval_seconds,
          maxConcurrentTasks: body.max_concurrent_tasks,
          roleTemplateId: body.role_template_id ?? null,
        })
        .returning();

      ok(res, formatAgent(agent!), 201);
    } catch (e) {
      next(e);
    }
  },
);

// GET /companies/:companyId/agents — List (paginated, filterable)
router.get('/companies/:companyId/agents', validateCompanyOwnership, async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const offset = (page - 1) * limit;

    const conditions = [eq(agents.companyId, companyId)];
    const status = req.query['status'] as string | undefined;
    const department = req.query['department'] as string | undefined;
    if (status) conditions.push(eq(agents.status, status));
    if (department) conditions.push(eq(agents.department, department));

    const where = and(...conditions);

    const [rows, [countRow]] = await Promise.all([
      db.select().from(agents).where(where).limit(limit).offset(offset).orderBy(agents.createdAt),
      db.select({ total: count() }).from(agents).where(where),
    ]);

    const total = countRow?.total ?? 0;
    paginated(res, rows.map(formatAgent), { page, limit, total: Number(total) });
  } catch (e) {
    next(e);
  }
});

// GET /companies/:companyId/agents/:id — Detail
router.get('/companies/:companyId/agents/:id', validateCompanyOwnership, async (req, res, next) => {
  try {
    const agent = await findAgent(param(req, 'companyId'), param(req, 'id'));
    if (!agent) return notFound(res, 'Agent');
    ok(res, formatAgent(agent));
  } catch (e) {
    next(e);
  }
});

// PUT /companies/:companyId/agents/:id — Update
router.put(
  '/companies/:companyId/agents/:id',
  validateCompanyOwnership,
  validate(updateAgentSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof updateAgentSchema>;
      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (body.name !== undefined) updates['name'] = body.name;
      if (body.title !== undefined) updates['title'] = body.title;
      if (body.department !== undefined) updates['department'] = body.department;
      if (body.level !== undefined) updates['level'] = body.level;
      if (body.reports_to !== undefined) updates['reportsTo'] = body.reports_to;
      if (body.runtime !== undefined) updates['runtimeConfig'] = body.runtime;
      if (body.budget_monthly !== undefined) updates['budgetMonthly'] = String(body.budget_monthly);
      if (body.heartbeat_interval_seconds !== undefined)
        updates['heartbeatIntervalSec'] = body.heartbeat_interval_seconds;
      if (body.max_concurrent_tasks !== undefined)
        updates['maxConcurrentTasks'] = body.max_concurrent_tasks;

      const [agent] = await db
        .update(agents)
        .set(updates)
        .where(
          and(eq(agents.id, param(req, 'id')), eq(agents.companyId, param(req, 'companyId'))),
        )
        .returning();

      if (!agent) return notFound(res, 'Agent');
      ok(res, formatAgent(agent));
    } catch (e) {
      next(e);
    }
  },
);

// DELETE /companies/:companyId/agents/:id — Fire
router.delete('/companies/:companyId/agents/:id', validateCompanyOwnership, async (req, res, next) => {
  try {
    const [agent] = await db
      .delete(agents)
      .where(
        and(eq(agents.id, param(req, 'id')), eq(agents.companyId, param(req, 'companyId'))),
      )
      .returning();

    if (!agent) return notFound(res, 'Agent');
    ok(res, { id: agent.id, deleted: true });
  } catch (e) {
    next(e);
  }
});

// POST /companies/:companyId/agents/:id/pause
router.post('/companies/:companyId/agents/:id/pause', validateCompanyOwnership, async (req, res, next) => {
  try {
    const agent = await findAgent(param(req, 'companyId'), param(req, 'id'));
    if (!agent) return notFound(res, 'Agent');

    if (agent.status === 'paused') {
      return err(res, 400, 'ALREADY_PAUSED', 'Agent is already paused');
    }

    const [updated] = await db
      .update(agents)
      .set({ status: 'paused', updatedAt: new Date() })
      .where(eq(agents.id, agent.id))
      .returning();

    ok(res, formatAgent(updated!));
  } catch (e) {
    next(e);
  }
});

// POST /companies/:companyId/agents/:id/resume
router.post('/companies/:companyId/agents/:id/resume', validateCompanyOwnership, async (req, res, next) => {
  try {
    const agent = await findAgent(param(req, 'companyId'), param(req, 'id'));
    if (!agent) return notFound(res, 'Agent');

    if (agent.status !== 'paused') {
      return err(res, 400, 'NOT_PAUSED', 'Agent is not paused');
    }

    const [updated] = await db
      .update(agents)
      .set({ status: 'idle', updatedAt: new Date() })
      .where(eq(agents.id, agent.id))
      .returning();

    ok(res, formatAgent(updated!));
  } catch (e) {
    next(e);
  }
});

// --- Helpers ---

async function findAgent(companyId: string, agentId: string) {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)));
  return agent ?? null;
}

type AgentRow = typeof agents.$inferSelect;

function formatAgent(row: AgentRow) {
  const budgetMonthly = Number(row.budgetMonthly);
  const budgetSpent = Number(row.budgetSpent);
  const budgetRemaining = Math.max(0, budgetMonthly - budgetSpent);
  const budgetUsagePct = budgetMonthly > 0 ? Math.round((budgetSpent / budgetMonthly) * 1000) / 10 : 0;
  const runtime = row.runtimeConfig as { type: string; model: string; endpoint: string };

  return {
    id: row.id,
    company_id: row.companyId,
    name: row.name,
    title: row.title,
    department: row.department,
    level: row.level,
    reports_to: row.reportsTo,
    status: row.status,
    current_task_id: null as string | null,
    runtime,
    budget_monthly: budgetMonthly,
    budget_spent: budgetSpent,
    budget_remaining: budgetRemaining,
    budget_usage_pct: budgetUsagePct,
    heartbeat_interval_seconds: row.heartbeatIntervalSec,
    last_heartbeat_at: row.lastHeartbeatAt?.toISOString() ?? null,
    performance: {
      overall_score: 0,
      trend: 'stable' as const,
      tasks_completed: 0,
      success_rate: 0,
      avg_task_duration_ms: 0,
    },
    created_at: row.createdAt?.toISOString() ?? null,
    updated_at: row.updatedAt?.toISOString() ?? null,
  };
}

// POST /companies/:companyId/agents/batch-hire — Batch create agents from role templates (onboarding)
import { ROLE_TEMPLATES, resolveRoleKey } from '../lib/role-templates.js';
import { sql } from '@buildcrew/db';

const batchHireSchema = z.object({
  roles: z.array(z.string().min(1)).min(1).max(12),
});

router.post(
  '/companies/:companyId/agents/batch-hire',
  validateCompanyOwnership,
  validate(batchHireSchema),
  async (req, res, next) => {
    try {
      const companyId = param(req, 'companyId');
      const { roles } = req.body as z.infer<typeof batchHireSchema>;

      // Get company budget for proportional allocation
      const [company] = await db.execute(
        sql`SELECT budget_monthly FROM companies WHERE id = ${companyId}`,
      );
      const companyBudget = Number((company as unknown as { budget_monthly: string })?.budget_monthly ?? 300);

      // Find CEO to set as reports_to for all new agents
      const [ceo] = await db
        .select({ id: agents.id })
        .from(agents)
        .where(and(eq(agents.companyId, companyId), eq(agents.title, 'CEO')));

      // Resolve and deduplicate roles
      const created: Array<{ id: string; name: string; title: string; department: string | null }> = [];
      const seen = new Set<string>();

      // Also skip roles that already exist in this company
      const existing = await db.select({ name: agents.name }).from(agents).where(eq(agents.companyId, companyId));
      const existingNames = new Set(existing.map((a) => a.name.toLowerCase()));

      for (const roleInput of roles) {
        const key = resolveRoleKey(roleInput);
        if (!key || seen.has(key)) continue;
        seen.add(key);

        const tpl = ROLE_TEMPLATES[key];
        if (!tpl || existingNames.has(tpl.name.toLowerCase())) continue;

        const [agent] = await db
          .insert(agents)
          .values({
            companyId,
            name: tpl.name,
            title: tpl.title,
            department: tpl.department,
            level: tpl.level,
            reportsTo: ceo?.id ?? null,
            status: 'idle',
            runtimeConfig: { provider: 'deepseek', model: 'deepseek-chat' },
            budgetMonthly: String(Math.round(companyBudget * tpl.budgetPct)),
            budgetSpent: '0',
            heartbeatIntervalSec: 300,
            maxConcurrentTasks: 2,
          })
          .returning();

        if (agent) {
          created.push({ id: agent.id, name: agent.name, title: agent.title, department: agent.department });
        }
      }

      ok(res, {
        hired: created,
        count: created.length,
        skipped: roles.length - created.length,
      }, 201);
    } catch (e) {
      next(e);
    }
  },
);

export { router as agentsRouter };

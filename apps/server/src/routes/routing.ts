import { Router } from 'express';
import { z } from 'zod';
import { eq, and, count } from '@buildcrew/db';
import { db, routingDecisions, configs } from '@buildcrew/db';
import { validate, parsePagination } from '../lib/validate.js';
import { ok, paginated, err } from '../lib/response.js';
import { param } from '../lib/params.js';
import { routeTask } from '../engines/smart-router.js';
import type { RoutingStrategy } from '../engines/smart-router.js';
import { validateCompanyOwnership } from '../middleware/company-ownership.js';

const router = Router();

// POST /companies/:companyId/tasks/:taskId/route — Manually trigger routing
router.post('/companies/:companyId/tasks/:taskId/route', validateCompanyOwnership, async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');
    const taskId = param(req, 'taskId');

    // Get company's default strategy
    const strategy = await getCompanyStrategy(companyId);

    const result = await routeTask(companyId, taskId, strategy);

    if (!result.selectedAgentId) {
      return err(res, 422, 'NO_AGENT', result.reasoning);
    }

    ok(res, {
      task_id: taskId,
      selected_agent_id: result.selectedAgentId,
      strategy: result.strategy,
      reasoning: result.reasoning,
      candidates: result.candidates,
    });
  } catch (e) {
    next(e);
  }
});

// GET /companies/:companyId/routing/decisions — Routing history
router.get('/companies/:companyId/routing/decisions', validateCompanyOwnership, async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const offset = (page - 1) * limit;

    const where = eq(routingDecisions.companyId, companyId);

    const [rows, [countRow]] = await Promise.all([
      db
        .select()
        .from(routingDecisions)
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(routingDecisions.createdAt),
      db.select({ total: count() }).from(routingDecisions).where(where),
    ]);

    const data = rows.map((r) => ({
      id: r.id,
      company_id: r.companyId,
      task_id: r.taskId,
      candidates: r.candidates,
      strategy: r.strategy,
      selected_agent_id: r.selectedAgentId,
      reasoning: r.reasoning,
      created_at: r.createdAt?.toISOString() ?? null,
    }));

    paginated(res, data, { page, limit, total: Number(countRow?.total ?? 0) });
  } catch (e) {
    next(e);
  }
});

// PUT /companies/:companyId/routing/strategy — Set default strategy
const strategySchema = z.object({
  strategy: z.enum(['cost_optimized', 'quality_first', 'speed_first', 'balanced', 'round_robin']),
});

router.put(
  '/companies/:companyId/routing/strategy',
  validateCompanyOwnership,
  validate(strategySchema),
  async (req, res, next) => {
    try {
      const companyId = param(req, 'companyId');
      const { strategy } = req.body as z.infer<typeof strategySchema>;

      // Upsert config
      const configKey = 'routing_strategy';
      const [existing] = await db
        .select()
        .from(configs)
        .where(
          and(
            eq(configs.companyId, companyId),
            eq(configs.entityType, 'company'),
            eq(configs.entityId, companyId),
          ),
        );

      if (existing) {
        await db
          .update(configs)
          .set({ configData: { strategy }, version: (existing.version ?? 0) + 1 })
          .where(eq(configs.id, existing.id));
      } else {
        await db.insert(configs).values({
          companyId,
          entityType: 'company',
          entityId: companyId,
          configData: { [configKey]: strategy },
        });
      }

      ok(res, { strategy });
    } catch (e) {
      next(e);
    }
  },
);

// --- Helper ---

async function getCompanyStrategy(companyId: string): Promise<RoutingStrategy> {
  const [config] = await db
    .select()
    .from(configs)
    .where(
      and(
        eq(configs.companyId, companyId),
        eq(configs.entityType, 'company'),
        eq(configs.entityId, companyId),
      ),
    );

  const data = config?.configData as Record<string, unknown> | null;
  const strategy = data?.['routing_strategy'] as RoutingStrategy | undefined;
  return strategy ?? 'balanced';
}

export { router as routingRouter, getCompanyStrategy };

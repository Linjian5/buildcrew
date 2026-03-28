import { Router } from 'express';
import { eq, sql } from '@buildcrew/db';
import { db, companies } from '@buildcrew/db';
import { ok, notFound } from '../lib/response.js';
import { param } from '../lib/params.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const router = Router();

// GET /users/me/usage — Personal total usage
router.get('/users/me/usage', authMiddleware, async (req, res, next) => {
  try {
    const userId = getUser(req).userId;

    const [totals] = await db.execute(
      sql`SELECT
            COALESCE(SUM(total_tokens), 0) as total_tokens,
            COALESCE(SUM(cost_usd::numeric), 0) as total_cost_usd,
            COUNT(*) as total_requests
          FROM usage_records WHERE user_id = ${userId}`,
    );

    const [thisMonth] = await db.execute(
      sql`SELECT
            COALESCE(SUM(total_tokens), 0) as tokens,
            COALESCE(SUM(cost_usd::numeric), 0) as cost_usd,
            COUNT(*) as requests
          FROM usage_records
          WHERE user_id = ${userId}
            AND created_at >= DATE_TRUNC('month', NOW())`,
    );

    const byProvider = await db.execute(
      sql`SELECT provider,
            SUM(total_tokens) as tokens,
            SUM(cost_usd::numeric) as cost_usd
          FROM usage_records WHERE user_id = ${userId}
          GROUP BY provider ORDER BY cost_usd DESC`,
    );

    const byModel = await db.execute(
      sql`SELECT model,
            SUM(total_tokens) as tokens,
            SUM(cost_usd::numeric) as cost_usd
          FROM usage_records WHERE user_id = ${userId}
          GROUP BY model ORDER BY cost_usd DESC`,
    );

    const t = totals as unknown as Record<string, string>;
    const m = thisMonth as unknown as Record<string, string>;

    ok(res, {
      total_tokens: Number(t['total_tokens']),
      total_cost_usd: Number(Number(t['total_cost_usd']).toFixed(6)),
      this_month: {
        tokens: Number(m['tokens']),
        cost_usd: Number(Number(m['cost_usd']).toFixed(6)),
        requests: Number(m['requests']),
      },
      by_provider: (byProvider as unknown as Array<Record<string, string>>).map((r) => ({
        provider: r['provider'],
        tokens: Number(r['tokens']),
        cost_usd: Number(Number(r['cost_usd']).toFixed(6)),
      })),
      by_model: (byModel as unknown as Array<Record<string, string>>).map((r) => ({
        model: r['model'],
        tokens: Number(r['tokens']),
        cost_usd: Number(Number(r['cost_usd']).toFixed(6)),
      })),
    });
  } catch (e) {
    next(e);
  }
});

// GET /users/me/usage/daily?days=30 — Daily trend
router.get('/users/me/usage/daily', authMiddleware, async (req, res, next) => {
  try {
    const userId = getUser(req).userId;
    const days = Math.min(Number(req.query['days'] ?? 30), 90);

    const rows = await db.execute(
      sql`SELECT DATE(created_at) as date,
            SUM(total_tokens) as tokens,
            SUM(cost_usd::numeric) as cost_usd,
            COUNT(*) as requests
          FROM usage_records
          WHERE user_id = ${userId}
            AND created_at >= NOW() - MAKE_INTERVAL(days => ${days})
          GROUP BY DATE(created_at)
          ORDER BY date`,
    );

    ok(res, (rows as unknown as Array<Record<string, string>>).map((r) => ({
      date: r['date'],
      tokens: Number(r['tokens']),
      cost_usd: Number(Number(r['cost_usd']).toFixed(6)),
      requests: Number(r['requests']),
    })));
  } catch (e) {
    next(e);
  }
});

// GET /companies/:companyId/usage — Company usage
router.get('/companies/:companyId/usage', async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');
    const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, companyId));
    if (!company) return notFound(res, 'Company');

    const [totals] = await db.execute(
      sql`SELECT
            COALESCE(SUM(total_tokens), 0) as total_tokens,
            COALESCE(SUM(cost_usd::numeric), 0) as total_cost_usd,
            COUNT(*) as total_requests
          FROM usage_records WHERE company_id = ${companyId}`,
    );

    const [thisMonth] = await db.execute(
      sql`SELECT
            COALESCE(SUM(total_tokens), 0) as tokens,
            COALESCE(SUM(cost_usd::numeric), 0) as cost_usd,
            COUNT(*) as requests
          FROM usage_records
          WHERE company_id = ${companyId}
            AND created_at >= DATE_TRUNC('month', NOW())`,
    );

    const t = totals as unknown as Record<string, string>;
    const m = thisMonth as unknown as Record<string, string>;

    ok(res, {
      company_id: companyId,
      total_tokens: Number(t['total_tokens']),
      total_cost_usd: Number(Number(t['total_cost_usd']).toFixed(6)),
      this_month: {
        tokens: Number(m['tokens']),
        cost_usd: Number(Number(m['cost_usd']).toFixed(6)),
        requests: Number(m['requests']),
      },
    });
  } catch (e) {
    next(e);
  }
});

// GET /companies/:companyId/usage/agents — Per-agent usage
router.get('/companies/:companyId/usage/agents', async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');

    const rows = await db.execute(
      sql`SELECT ur.agent_id, a.name as agent_name,
            SUM(ur.total_tokens) as tokens,
            SUM(ur.cost_usd::numeric) as cost_usd,
            COUNT(*) as requests
          FROM usage_records ur
          JOIN agents a ON a.id = ur.agent_id
          WHERE ur.company_id = ${companyId}
          GROUP BY ur.agent_id, a.name
          ORDER BY cost_usd DESC`,
    );

    ok(res, (rows as unknown as Array<Record<string, string>>).map((r) => ({
      agent_id: r['agent_id'],
      agent_name: r['agent_name'],
      tokens: Number(r['tokens']),
      cost_usd: Number(Number(r['cost_usd']).toFixed(6)),
      requests: Number(r['requests']),
    })));
  } catch (e) {
    next(e);
  }
});

// GET /companies/:companyId/usage/models — Per-model usage
router.get('/companies/:companyId/usage/models', async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');

    const rows = await db.execute(
      sql`SELECT provider, model,
            SUM(total_tokens) as tokens,
            SUM(cost_usd::numeric) as cost_usd,
            COUNT(*) as requests
          FROM usage_records
          WHERE company_id = ${companyId}
          GROUP BY provider, model
          ORDER BY cost_usd DESC`,
    );

    ok(res, (rows as unknown as Array<Record<string, string>>).map((r) => ({
      provider: r['provider'],
      model: r['model'],
      tokens: Number(r['tokens']),
      cost_usd: Number(Number(r['cost_usd']).toFixed(6)),
      requests: Number(r['requests']),
    })));
  } catch (e) {
    next(e);
  }
});

export { router as usageRouter };

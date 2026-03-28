import { Router } from 'express';
import { eq, sql } from '@buildcrew/db';
import { db } from '@buildcrew/db';
import { companies, agents, tasks } from '@buildcrew/db';
import { ok } from '../lib/response.js';
import { param } from '../lib/params.js';
import { validateCompanyOwnership } from '../middleware/company-ownership.js';

const router = Router();

// GET /companies/:companyId/budget — Company budget overview
router.get('/companies/:companyId/budget', validateCompanyOwnership, async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');
    const company = (req as import('express').Request & { company: typeof companies.$inferSelect }).company;

    const [agentSummary] = await db
      .select({
        totalBudget: sql<string>`COALESCE(SUM(${agents.budgetMonthly}::numeric), 0)`,
        totalSpent: sql<string>`COALESCE(SUM(${agents.budgetSpent}::numeric), 0)`,
        agentCount: sql<number>`COUNT(*)`,
      })
      .from(agents)
      .where(eq(agents.companyId, companyId));

    const [taskSummary] = await db
      .select({
        totalEstimated: sql<string>`COALESCE(SUM(${tasks.costEstimated}::numeric), 0)`,
        totalActual: sql<string>`COALESCE(SUM(${tasks.costActual}::numeric), 0)`,
        completedTasks: sql<number>`COUNT(*) FILTER (WHERE ${tasks.status} = 'done')`,
        totalTasks: sql<number>`COUNT(*)`,
      })
      .from(tasks)
      .where(eq(tasks.companyId, companyId));

    const budgetMonthly = Number(company.budgetMonthly);
    const totalSpent = Number(agentSummary?.totalSpent ?? 0);

    ok(res, {
      company_id: companyId,
      budget_monthly: budgetMonthly,
      total_spent: totalSpent,
      total_remaining: Math.max(0, budgetMonthly - totalSpent),
      usage_pct: budgetMonthly > 0 ? Math.round((totalSpent / budgetMonthly) * 1000) / 10 : 0,
      agent_budget_total: Number(agentSummary?.totalBudget ?? 0),
      agent_count: Number(agentSummary?.agentCount ?? 0),
      task_cost_estimated: Number(taskSummary?.totalEstimated ?? 0),
      task_cost_actual: Number(taskSummary?.totalActual ?? 0),
      tasks_completed: Number(taskSummary?.completedTasks ?? 0),
      tasks_total: Number(taskSummary?.totalTasks ?? 0),
    });
  } catch (e) {
    next(e);
  }
});

// GET /companies/:companyId/budget/agents — Per-agent budget breakdown
router.get('/companies/:companyId/budget/agents', validateCompanyOwnership, async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');

    const rows = await db
      .select()
      .from(agents)
      .where(eq(agents.companyId, companyId))
      .orderBy(agents.name);

    const data = rows.map((a) => {
      const monthly = Number(a.budgetMonthly);
      const spent = Number(a.budgetSpent);
      return {
        agent_id: a.id,
        name: a.name,
        title: a.title,
        department: a.department,
        budget_monthly: monthly,
        budget_spent: spent,
        budget_remaining: Math.max(0, monthly - spent),
        usage_pct: monthly > 0 ? Math.round((spent / monthly) * 1000) / 10 : 0,
        status: a.status,
      };
    });

    ok(res, data);
  } catch (e) {
    next(e);
  }
});

// GET /companies/:companyId/budget/daily — Daily spend trends (last 30 days)
router.get('/companies/:companyId/budget/daily', validateCompanyOwnership, async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');

    // Get daily task costs from completed tasks
    const rows = await db.execute(
      sql`SELECT
            DATE(completed_at) as date,
            COALESCE(SUM(cost_actual::numeric), 0) as daily_cost,
            COUNT(*) as tasks_completed
          FROM tasks
          WHERE company_id = ${companyId}
            AND completed_at IS NOT NULL
            AND completed_at >= NOW() - INTERVAL '30 days'
          GROUP BY DATE(completed_at)
          ORDER BY DATE(completed_at)`,
    );

    const data = (rows as unknown as Array<{ date: string; daily_cost: string; tasks_completed: string }>).map((r) => ({
      date: r.date,
      daily_cost: Number(r.daily_cost),
      tasks_completed: Number(r.tasks_completed),
    }));

    ok(res, data);
  } catch (e) {
    next(e);
  }
});

export { router as budgetRouter };

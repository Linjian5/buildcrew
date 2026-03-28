import type { Request, Response, NextFunction } from 'express';
// TEMPORARILY: imports below are unused while limits are disabled.
// Re-enable when commercializing.
// import { eq, sql, count } from '@buildcrew/db';
// import { db, companies, subscriptions } from '@buildcrew/db';
// import { getUser } from './auth.js';

type Plan = 'free' | 'pro' | 'team';

// Preserved for re-enablement
// const PLAN_LEVEL: Record<Plan, number> = { free: 0, pro: 1, team: 2 };
// const FREE_LIMITS: Record<string, number> = { agents: 5, companies: 3, knowledge: 50, daily_messages: 20 };

export const PLAN_FEATURES = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'USD',
    interval: null,
    features: {
      agents: 5, companies: 3,
      smart_router_strategies: ['balanced'],
      guardian_auto_response: false,
      knowledge_entries: 50,
      ab_testing: false,
      daily_messages: 20,
      group_management: false,
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    currency: 'USD',
    interval: 'month',
    features: {
      agents: -1, companies: -1,
      smart_router_strategies: ['balanced', 'cost_optimized', 'quality_first', 'speed_first', 'round_robin'],
      guardian_auto_response: true,
      knowledge_entries: -1,
      ab_testing: true,
      daily_messages: -1,
      group_management: true,
    },
  },
  {
    id: 'team',
    name: 'Team',
    price: 99,
    currency: 'USD',
    interval: 'month',
    features: {
      agents: -1, companies: -1,
      smart_router_strategies: ['balanced', 'cost_optimized', 'quality_first', 'speed_first', 'round_robin'],
      guardian_auto_response: true,
      knowledge_entries: -1,
      ab_testing: true,
      daily_messages: -1,
      group_management: true,
    },
  },
];

// TEMPORARILY DISABLED — re-enable for commercialization
// async function getUserPlan(userId: string): Promise<Plan> {
//   const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
//   if (sub && sub.status === 'active') return sub.plan as Plan;
//   return 'free';
// }

/**
 * Require a minimum subscription plan.
 * TEMPORARILY DISABLED for dev/testing — all plans treated as unlimited.
 * Re-enable for commercialization by removing the early return below.
 */
export function requirePlan(_minPlan: Plan) {
  return (_req: Request, _res: Response, next: NextFunction) => {
    next(); // TODO: re-enable plan enforcement for commercialization
  };
}

/**
 * Check resource limits for free plan.
 * TEMPORARILY DISABLED for dev/testing — no limits enforced.
 * Re-enable for commercialization by removing the early return below.
 */
export function checkLimit(_resource: string) {
  return (_req: Request, _res: Response, next: NextFunction) => {
    next(); // TODO: re-enable limit checks for commercialization
  };
}

/* Original checkLimit implementation — preserved for re-enablement:
export function _checkLimit_original(resource: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUser(req).userId;
      const plan = await getUserPlan(userId);
      if (plan !== 'free') return next(); // pro/team have no limits

      const limit = FREE_LIMITS[resource];
      if (!limit) return next();

      let current = 0;
      if (resource === 'agents') {
        const userCompanies = await db.select({ id: companies.id }).from(companies).where(eq(companies.userId, userId));
        if (userCompanies.length > 0) {
          const companyIds = userCompanies.map((c) => c.id);
          const [result] = await db.execute(
            sql`SELECT COUNT(*) as cnt FROM agents WHERE company_id = ANY(${companyIds})`,
          );
          current = Number((result as unknown as { cnt: string }).cnt);
        }
      } else if (resource === 'companies') {
        const [result] = await db.select({ total: count() }).from(companies).where(eq(companies.userId, userId));
        current = Number(result?.total ?? 0);
      } else if (resource === 'knowledge') {
        const userCompanies = await db.select({ id: companies.id }).from(companies).where(eq(companies.userId, userId));
        if (userCompanies.length > 0) {
          const companyIds = userCompanies.map((c) => c.id);
          const [result] = await db.execute(
            sql`SELECT COUNT(*) as cnt FROM knowledge_entries WHERE company_id = ANY(${companyIds}) AND expired = false`,
          );
          current = Number((result as unknown as { cnt: string }).cnt);
        }
      } else if (resource === 'daily_messages') {
        const [result] = await db.execute(
          sql`SELECT COUNT(*) as cnt FROM chat_messages cm
              JOIN chat_threads ct ON ct.id = cm.thread_id
              WHERE ct.user_id = ${userId}
              AND cm.sender_type = 'user'
              AND cm.created_at >= DATE_TRUNC('day', NOW())`,
        );
        current = Number((result as unknown as { cnt: string }).cnt);
      }

      if (current >= limit) {
        res.status(403).json({
          data: null,
          error: {
            code: 'LIMIT_REACHED',
            message: `Free plan limit: ${limit} ${resource}`,
            limit,
            current,
            requiredPlan: 'pro',
          },
        });
        return;
      }
      next();
    } catch {
      next();
    }
  };
}
*/

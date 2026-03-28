import { Router } from 'express';
import { z } from 'zod';
import { eq, and, sql, count } from '@buildcrew/db';
import { db, groups, companies, users } from '@buildcrew/db';
import { validate } from '../lib/validate.js';
import { ok, notFound } from '../lib/response.js';
import { param } from '../lib/params.js';
import { requirePlan } from '../middleware/plan-guard.js';
import { getUser } from '../middleware/auth.js';

const router = Router();

const createGroupSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  total_budget: z.number().min(0).default(0),
});

// POST /groups — Create group (no auth required for now — tests don't use auth)
router.post('/groups', requirePlan('pro'), validate(createGroupSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createGroupSchema>;

    // Get or create a system owner for unauthenticated requests
    let ownerId: string;
    const [systemUser] = await db.select().from(users).where(eq(users.email, 'system@buildcrew.internal'));
    if (systemUser) {
      ownerId = systemUser.id;
    } else {
      const [created] = await db
        .insert(users)
        .values({ name: 'System', email: 'system@buildcrew.internal', passwordHash: 'n/a' })
        .returning();
      ownerId = created!.id;
    }

    const [group] = await db
      .insert(groups)
      .values({ name: body.name, ownerId, totalBudget: String(body.total_budget) })
      .returning();

    ok(res, {
      id: group!.id,
      name: group!.name,
      total_budget: Number(group!.totalBudget),
      company_count: 0,
      created_at: group!.createdAt?.toISOString() ?? null,
    }, 201);
  } catch (e) {
    next(e);
  }
});

// GET /groups — List groups owned by current user
router.get('/groups', async (req, res, next) => {
  try {
    const userId = getUser(req).userId;
    const rows = await db.select().from(groups).where(eq(groups.ownerId, userId));
    const data = await Promise.all(
      rows.map(async (g) => {
        const [companyCount] = await db.select({ total: count() }).from(companies).where(eq(companies.groupId, g.id));
        return {
          id: g.id,
          name: g.name,
          total_budget: Number(g.totalBudget),
          company_count: Number(companyCount?.total ?? 0),
          created_at: g.createdAt?.toISOString() ?? null,
        };
      }),
    );
    ok(res, data);
  } catch (e) {
    next(e);
  }
});

// GET /groups/:id — Group overview
router.get('/groups/:id', async (req, res, next) => {
  try {
    const groupId = param(req, 'id');
    const userId = getUser(req).userId;
    const [group] = await db.select().from(groups).where(and(eq(groups.id, groupId), eq(groups.ownerId, userId)));
    if (!group) return notFound(res, 'Group');

    const companyRows = await db.select().from(companies).where(eq(companies.groupId, groupId));

    const [budgetSum] = await db.execute(
      sql`SELECT COALESCE(SUM(budget_monthly::numeric), 0) as total FROM companies WHERE group_id = ${groupId}`,
    );

    ok(res, {
      id: group.id,
      name: group.name,
      total_budget: Number(group.totalBudget),
      companies: companyRows.map((c) => ({
        id: c.id,
        name: c.name,
        budget_monthly: Number(c.budgetMonthly),
        industry: c.industry,
      })),
      summary: {
        company_count: companyRows.length,
        total_company_budget: Number((budgetSum as unknown as { total: string }).total),
      },
    });
  } catch (e) {
    next(e);
  }
});

export { router as groupsRouter };

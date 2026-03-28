import { Router } from 'express';
import { z } from 'zod';
import { eq, and, sql, count, inArray } from '@buildcrew/db';
import { db, companies, agents } from '@buildcrew/db';
import { validate, parsePagination } from '../lib/validate.js';
import { ok, paginated, notFound } from '../lib/response.js';
import { param } from '../lib/params.js';
import { getUser } from '../middleware/auth.js';
import { checkLimit } from '../middleware/plan-guard.js';

const router = Router();

// --- Schemas ---

const createCompanySchema = z.object({
  name: z.string().min(1).max(200),
  mission: z.string().max(2000).optional(),
  industry: z.string().max(100).optional(),
  template: z.enum(['saas', 'ecommerce', 'content', 'design', 'custom']).optional(),
  budget_monthly: z.number().min(0).default(0),
  currency: z.string().length(3).default('USD'),
  group_id: z.string().uuid().optional(),
});

const updateCompanySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  mission: z.string().max(2000).optional(),
  industry: z.string().max(100).optional(),
  budget_monthly: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
});

// --- Routes ---

// POST /companies — Create (bound to authenticated user) + auto-create CEO Agent
// Dedup: same name + same user within 5 minutes → return existing
router.post('/companies', checkLimit('companies'), validate(createCompanySchema), async (req, res, next) => {
  try {
    const userId = getUser(req).userId;
    const body = req.body as z.infer<typeof createCompanySchema>;

    // Dedup check: same user + created within last 5 minutes (any name — prevents ghost companies on onboarding back/forth)
    const [existing] = await db
      .select()
      .from(companies)
      .where(
        and(
          eq(companies.userId, userId),
          sql`${companies.createdAt} > NOW() - INTERVAL '5 minutes'`,
        ),
      );

    if (existing) {
      // Update name/mission if user changed them on retry
      if (existing.name !== body.name || existing.mission !== body.mission || existing.template !== body.template) {
        await db.update(companies).set({
          name: body.name,
          mission: body.mission,
          industry: body.industry,
          template: body.template,
          budgetMonthly: String(body.budget_monthly),
          updatedAt: new Date(),
        }).where(eq(companies.id, existing.id));
        existing.name = body.name;
        existing.mission = body.mission ?? existing.mission;
        existing.template = body.template ?? existing.template;
      }
      // Return the existing company + its CEO (fix department if wrong)
      const [existingCeo] = await db
        .select()
        .from(agents)
        .where(and(eq(agents.companyId, existing.id), eq(agents.title, 'CEO')));

      // Bug #4 fix: ensure CEO department is always 'executive'
      if (existingCeo && existingCeo.department !== 'executive') {
        await db.update(agents).set({ department: 'executive' }).where(eq(agents.id, existingCeo.id));
        existingCeo.department = 'executive';
      }

      const [agentCount] = await db
        .select({
          total: count(),
          active: count(sql`CASE WHEN ${agents.status} IN ('working', 'idle') THEN 1 END`),
        })
        .from(agents)
        .where(eq(agents.companyId, existing.id));

      const result = formatCompany(existing, Number(agentCount?.total ?? 0), Number(agentCount?.active ?? 0));
      return ok(res, {
        ...result,
        ceo_agent: existingCeo ? { id: existingCeo.id, name: existingCeo.name, title: existingCeo.title } : null,
        _deduplicated: true,
      }, 200); // 200, not 201 — it's not a new creation
    }

    const [company] = await db
      .insert(companies)
      .values({
        userId,
        name: body.name,
        mission: body.mission,
        industry: body.industry,
        template: body.template,
        budgetMonthly: String(body.budget_monthly),
        currency: body.currency,
        groupId: body.group_id,
      })
      .returning();

    if (!company) return notFound(res, 'Company');

    // Auto-create CEO Agent "Aria"
    const [ceoAgent] = await db
      .insert(agents)
      .values({
        companyId: company.id,
        name: 'Aria',
        title: 'CEO',
        department: 'executive',
        level: 'executive',
        status: 'idle',
        runtimeConfig: { provider: 'deepseek', model: 'deepseek-chat' },
        budgetMonthly: String(Math.round(body.budget_monthly * 0.2)),
        budgetSpent: '0',
        heartbeatIntervalSec: 300,
        maxConcurrentTasks: 3,
      })
      .returning();

    const result = formatCompany(company, 1, 1);
    ok(res, {
      ...result,
      ceo_agent: ceoAgent ? {
        id: ceoAgent.id,
        name: ceoAgent.name,
        title: ceoAgent.title,
      } : null,
    }, 201);
  } catch (e) {
    next(e);
  }
});

// GET /companies — List (only current user's companies, paginated)
router.get('/companies', async (req, res, next) => {
  try {
    const userId = getUser(req).userId;
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const offset = (page - 1) * limit;

    const userFilter = eq(companies.userId, userId);

    const [rows, [countRow]] = await Promise.all([
      db.select().from(companies).where(userFilter).limit(limit).offset(offset).orderBy(companies.createdAt),
      db.select({ total: count() }).from(companies).where(userFilter),
    ]);

    const total = countRow?.total ?? 0;

    const companyIds = rows.map((r) => r.id);
    const agentCounts =
      companyIds.length > 0
        ? await db
            .select({
              companyId: agents.companyId,
              total: count(),
              active: count(
                sql`CASE WHEN ${agents.status} IN ('working', 'idle') THEN 1 END`,
              ),
            })
            .from(agents)
            .where(inArray(agents.companyId, companyIds))
            .groupBy(agents.companyId)
        : [];

    const countsMap = new Map(agentCounts.map((a) => [a.companyId, a]));

    const data = rows.map((r) => {
      const counts = countsMap.get(r.id);
      return formatCompany(r, Number(counts?.total ?? 0), Number(counts?.active ?? 0));
    });

    paginated(res, data, { page, limit, total: Number(total) });
  } catch (e) {
    next(e);
  }
});

// GET /companies/:id — Detail (must belong to user)
router.get('/companies/:id', async (req, res, next) => {
  try {
    const userId = getUser(req).userId;
    const [company] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, param(req, 'id')), eq(companies.userId, userId)));

    if (!company) return notFound(res, 'Company');

    const [agentCount] = await db
      .select({
        total: count(),
        active: count(
          sql`CASE WHEN ${agents.status} IN ('working', 'idle') THEN 1 END`,
        ),
      })
      .from(agents)
      .where(eq(agents.companyId, company.id));

    ok(res, formatCompany(company, Number(agentCount?.total ?? 0), Number(agentCount?.active ?? 0)));
  } catch (e) {
    next(e);
  }
});

// PUT /companies/:id — Update (must belong to user)
router.put('/companies/:id', validate(updateCompanySchema), async (req, res, next) => {
  try {
    const userId = getUser(req).userId;
    const body = req.body as z.infer<typeof updateCompanySchema>;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updates['name'] = body.name;
    if (body.mission !== undefined) updates['mission'] = body.mission;
    if (body.industry !== undefined) updates['industry'] = body.industry;
    if (body.budget_monthly !== undefined) updates['budgetMonthly'] = String(body.budget_monthly);
    if (body.currency !== undefined) updates['currency'] = body.currency;

    const [company] = await db
      .update(companies)
      .set(updates)
      .where(and(eq(companies.id, param(req, 'id')), eq(companies.userId, userId)))
      .returning();

    if (!company) return notFound(res, 'Company');

    const [agentCount] = await db
      .select({
        total: count(),
        active: count(
          sql`CASE WHEN ${agents.status} IN ('working', 'idle') THEN 1 END`,
        ),
      })
      .from(agents)
      .where(eq(agents.companyId, company.id));

    ok(res, formatCompany(company, Number(agentCount?.total ?? 0), Number(agentCount?.active ?? 0)));
  } catch (e) {
    next(e);
  }
});

// DELETE /companies/:id — Delete (must belong to user)
// B-00b: Manual cascade delete in transaction to handle non-CASCADE FKs on agents
router.delete('/companies/:id', async (req, res, next) => {
  try {
    const userId = getUser(req).userId;
    const companyId = param(req, 'id');

    // Verify ownership
    const [company] = await db.select().from(companies)
      .where(and(eq(companies.id, companyId), eq(companies.userId, userId)));
    if (!company) return notFound(res, 'Company');

    // Transaction: delete child tables in dependency order
    await db.transaction(async (tx) => {
      // Tables referencing agents (must delete before agents)
      await tx.execute(sql`DELETE FROM chat_messages WHERE thread_id IN (SELECT id FROM chat_threads WHERE company_id = ${companyId})`);
      await tx.execute(sql`DELETE FROM chat_threads WHERE company_id = ${companyId}`);
      await tx.execute(sql`DELETE FROM task_scores WHERE agent_id IN (SELECT id FROM agents WHERE company_id = ${companyId})`);
      await tx.execute(sql`DELETE FROM usage_records WHERE company_id = ${companyId}`);
      await tx.execute(sql`DELETE FROM routing_decisions WHERE company_id = ${companyId}`);
      await tx.execute(sql`DELETE FROM reviews WHERE company_id = ${companyId}`);
      await tx.execute(sql`DELETE FROM approvals WHERE company_id = ${companyId}`);
      await tx.execute(sql`DELETE FROM guardian_alerts WHERE company_id = ${companyId}`);
      await tx.execute(sql`DELETE FROM guardian_policies WHERE company_id = ${companyId}`);
      await tx.execute(sql`DELETE FROM knowledge_entries WHERE company_id = ${companyId}`);
      await tx.execute(sql`DELETE FROM conversations WHERE agent_id IN (SELECT id FROM agents WHERE company_id = ${companyId})`);
      await tx.execute(sql`DELETE FROM tasks WHERE company_id = ${companyId}`);
      await tx.execute(sql`DELETE FROM goals WHERE company_id = ${companyId}`);
      await tx.execute(sql`DELETE FROM projects WHERE company_id = ${companyId}`);
      await tx.execute(sql`DELETE FROM agent_loans WHERE from_company_id = ${companyId} OR to_company_id = ${companyId}`);
      await tx.execute(sql`DELETE FROM experiments WHERE company_id = ${companyId}`);
      await tx.execute(sql`DELETE FROM configs WHERE company_id = ${companyId}`);
      // Now safe to delete agents
      await tx.execute(sql`DELETE FROM agents WHERE company_id = ${companyId}`);
      // Finally delete company
      await tx.execute(sql`DELETE FROM companies WHERE id = ${companyId}`);
    });

    // WebSocket notification
    const { emitEvent } = await import('../ws.js');
    emitEvent(companyId, 'company.deleted', { id: companyId });

    ok(res, { id: companyId, deleted: true });
  } catch (e) {
    next(e);
  }
});

// --- Helpers ---

type CompanyRow = typeof companies.$inferSelect;

function formatCompany(row: CompanyRow, agentCount: number, activeAgentCount: number) {
  return {
    id: row.id,
    name: row.name,
    mission: row.mission,
    industry: row.industry,
    template: row.template,
    budget_monthly: Number(row.budgetMonthly),
    currency: row.currency,
    agent_count: agentCount,
    active_agent_count: activeAgentCount,
    created_at: row.createdAt?.toISOString() ?? null,
    updated_at: row.updatedAt?.toISOString() ?? null,
  };
}

export { router as companiesRouter };

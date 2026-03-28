import { Router } from 'express';
import { z } from 'zod';
import { eq, and, count } from '@buildcrew/db';
import { db, guardianAlerts, guardianPolicies } from '@buildcrew/db';
import { validate, parsePagination } from '../lib/validate.js';
import { ok, paginated, notFound } from '../lib/response.js';
import { param } from '../lib/params.js';
import { validateCompanyOwnership } from '../middleware/company-ownership.js';

const router = Router();

// ========== ALERTS ==========

// GET /companies/:companyId/guardian/alerts
router.get('/companies/:companyId/guardian/alerts', validateCompanyOwnership, async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const offset = (page - 1) * limit;

    const conditions = [eq(guardianAlerts.companyId, companyId)];
    const severity = req.query['severity'] as string | undefined;
    const resolved = req.query['resolved'] as string | undefined;
    if (severity) conditions.push(eq(guardianAlerts.severity, severity));
    if (resolved !== undefined) conditions.push(eq(guardianAlerts.resolved, resolved === 'true'));

    const where = and(...conditions);

    const [rows, [countRow]] = await Promise.all([
      db.select().from(guardianAlerts).where(where).limit(limit).offset(offset).orderBy(guardianAlerts.createdAt),
      db.select({ total: count() }).from(guardianAlerts).where(where),
    ]);

    const data = rows.map(formatAlert);
    paginated(res, data, { page, limit, total: Number(countRow?.total ?? 0) });
  } catch (e) {
    next(e);
  }
});

// PUT /companies/:companyId/guardian/alerts/:alertId — Resolve/dismiss
const resolveAlertSchema = z.object({
  action: z.enum(['resolve', 'dismiss']),
  resolved_by: z.string().optional(),
});

router.put(
  '/companies/:companyId/guardian/alerts/:alertId',
  validateCompanyOwnership,
  validate(resolveAlertSchema),
  async (req, res, next) => {
    try {
      const alertId = param(req, 'alertId');
      const body = req.body as z.infer<typeof resolveAlertSchema>;

      const [alert] = await db
        .update(guardianAlerts)
        .set({
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy: body.resolved_by ?? body.action,
        })
        .where(
          and(
            eq(guardianAlerts.id, alertId),
            eq(guardianAlerts.companyId, param(req, 'companyId')),
          ),
        )
        .returning();

      if (!alert) return notFound(res, 'Alert');
      ok(res, formatAlert(alert));
    } catch (e) {
      next(e);
    }
  },
);

// ========== POLICIES ==========

// GET /companies/:companyId/guardian/policies
router.get('/companies/:companyId/guardian/policies', validateCompanyOwnership, async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');
    const rows = await db
      .select()
      .from(guardianPolicies)
      .where(eq(guardianPolicies.companyId, companyId))
      .orderBy(guardianPolicies.policyType);

    const data = rows.map((r) => ({
      id: r.id,
      company_id: r.companyId,
      policy_type: r.policyType,
      config: r.config,
      enabled: r.enabled,
      created_at: r.createdAt?.toISOString() ?? null,
      updated_at: r.updatedAt?.toISOString() ?? null,
    }));

    ok(res, data);
  } catch (e) {
    next(e);
  }
});

// PUT /companies/:companyId/guardian/policies
const updatePolicySchema = z.object({
  policy_type: z.string().min(1),
  config: z.record(z.string(), z.unknown()),
  enabled: z.boolean().optional(),
});

router.put(
  '/companies/:companyId/guardian/policies',
  validateCompanyOwnership,
  validate(updatePolicySchema),
  async (req, res, next) => {
    try {
      const companyId = param(req, 'companyId');
      const body = req.body as z.infer<typeof updatePolicySchema>;

      // Upsert by policy_type
      const [existing] = await db
        .select()
        .from(guardianPolicies)
        .where(
          and(
            eq(guardianPolicies.companyId, companyId),
            eq(guardianPolicies.policyType, body.policy_type),
          ),
        );

      if (existing) {
        const [updated] = await db
          .update(guardianPolicies)
          .set({
            config: body.config,
            enabled: body.enabled ?? existing.enabled,
            updatedAt: new Date(),
          })
          .where(eq(guardianPolicies.id, existing.id))
          .returning();
        ok(res, formatPolicy(updated!));
      } else {
        const [created] = await db
          .insert(guardianPolicies)
          .values({
            companyId,
            policyType: body.policy_type,
            config: body.config,
            enabled: body.enabled ?? true,
          })
          .returning();
        ok(res, formatPolicy(created!), 201);
      }
    } catch (e) {
      next(e);
    }
  },
);

// --- Helpers ---

type AlertRow = typeof guardianAlerts.$inferSelect;

function formatAlert(row: AlertRow) {
  return {
    id: row.id,
    company_id: row.companyId,
    agent_id: row.agentId,
    task_id: row.taskId,
    severity: row.severity,
    category: row.category,
    description: row.description,
    evidence: row.evidence,
    auto_action: row.autoAction,
    resolved: row.resolved,
    resolved_at: row.resolvedAt?.toISOString() ?? null,
    resolved_by: row.resolvedBy,
    created_at: row.createdAt?.toISOString() ?? null,
  };
}

type PolicyRow = typeof guardianPolicies.$inferSelect;

function formatPolicy(row: PolicyRow) {
  return {
    id: row.id,
    company_id: row.companyId,
    policy_type: row.policyType,
    config: row.config,
    enabled: row.enabled,
    created_at: row.createdAt?.toISOString() ?? null,
    updated_at: row.updatedAt?.toISOString() ?? null,
  };
}

export { router as guardianRouter };

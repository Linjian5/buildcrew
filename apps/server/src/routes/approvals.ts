import { Router } from 'express';
import { z } from 'zod';
import { eq, and, count } from '@buildcrew/db';
import { db, approvals, reviews, guardianAlerts } from '@buildcrew/db';
import { validate, parsePagination } from '../lib/validate.js';
import { ok, paginated, notFound, err } from '../lib/response.js';
import { param } from '../lib/params.js';

const router = Router();

// GET /approvals/pending — All pending approvals (optionally filtered by company)
router.get('/approvals/pending', async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const offset = (page - 1) * limit;

    const conditions = [eq(approvals.status, 'pending')];
    const companyId = req.query['company_id'] as string | undefined;
    if (companyId) conditions.push(eq(approvals.companyId, companyId));

    const where = and(...conditions);

    const [rows, [countRow]] = await Promise.all([
      db.select().from(approvals).where(where).limit(limit).offset(offset).orderBy(approvals.createdAt),
      db.select({ total: count() }).from(approvals).where(where),
    ]);

    paginated(res, rows.map(formatApproval), { page, limit, total: Number(countRow?.total ?? 0) });
  } catch (e) {
    next(e);
  }
});

// POST /approvals/:id/approve
const decisionSchema = z.object({
  decided_by: z.string().optional(),
  comment: z.string().optional(),
});

router.post('/approvals/:id/approve', validate(decisionSchema), async (req, res, next) => {
  try {
    const approvalId = param(req, 'id');
    const body = req.body as z.infer<typeof decisionSchema>;

    const [approval] = await db.select().from(approvals).where(eq(approvals.id, approvalId));
    if (!approval) return notFound(res, 'Approval');
    if (approval.status !== 'pending') {
      return err(res, 400, 'ALREADY_DECIDED', `Approval already ${approval.status}`);
    }

    const [updated] = await db
      .update(approvals)
      .set({
        status: 'approved',
        decidedBy: body.decided_by ?? 'user',
        decidedAt: new Date(),
      })
      .where(eq(approvals.id, approvalId))
      .returning();

    // Cascade: if source is review_human_gate, approve the review
    if (approval.source === 'review_human_gate') {
      await db
        .update(reviews)
        .set({ status: 'passed', updatedAt: new Date() })
        .where(eq(reviews.id, approval.sourceId));
    }

    // Cascade: if source is guardian_critical, resolve the alert
    if (approval.source === 'guardian_critical') {
      await db
        .update(guardianAlerts)
        .set({ resolved: true, resolvedAt: new Date(), resolvedBy: body.decided_by ?? 'user' })
        .where(eq(guardianAlerts.id, approval.sourceId));
    }

    ok(res, formatApproval(updated!));
  } catch (e) {
    next(e);
  }
});

// POST /approvals/:id/reject
router.post('/approvals/:id/reject', validate(decisionSchema), async (req, res, next) => {
  try {
    const approvalId = param(req, 'id');
    const body = req.body as z.infer<typeof decisionSchema>;

    const [approval] = await db.select().from(approvals).where(eq(approvals.id, approvalId));
    if (!approval) return notFound(res, 'Approval');
    if (approval.status !== 'pending') {
      return err(res, 400, 'ALREADY_DECIDED', `Approval already ${approval.status}`);
    }

    const [updated] = await db
      .update(approvals)
      .set({
        status: 'rejected',
        decidedBy: body.decided_by ?? 'user',
        decidedAt: new Date(),
      })
      .where(eq(approvals.id, approvalId))
      .returning();

    // Cascade: if source is review_human_gate, reject the review
    if (approval.source === 'review_human_gate') {
      await db
        .update(reviews)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(reviews.id, approval.sourceId));
    }

    ok(res, formatApproval(updated!));
  } catch (e) {
    next(e);
  }
});

// --- Helper ---

type ApprovalRow = typeof approvals.$inferSelect;

function formatApproval(row: ApprovalRow) {
  return {
    id: row.id,
    company_id: row.companyId,
    source: row.source,
    source_id: row.sourceId,
    title: row.title,
    description: row.description,
    status: row.status,
    metadata: row.metadata,
    decided_by: row.decidedBy,
    decided_at: row.decidedAt?.toISOString() ?? null,
    created_at: row.createdAt?.toISOString() ?? null,
  };
}

export { router as approvalsRouter };

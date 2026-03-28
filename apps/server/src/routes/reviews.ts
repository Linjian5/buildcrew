import { Router } from 'express';
import { z } from 'zod';
import { eq, and, count } from '@buildcrew/db';
import { db, reviews } from '@buildcrew/db';
import { validate, parsePagination } from '../lib/validate.js';
import { ok, paginated, notFound, err } from '../lib/response.js';
import { param } from '../lib/params.js';
import { validateCompanyOwnership } from '../middleware/company-ownership.js';
// import { createHumanGate } from '../engines/review-pipeline.js';

const router = Router();

// GET /companies/:companyId/reviews — List reviews
router.get('/companies/:companyId/reviews', validateCompanyOwnership, async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const offset = (page - 1) * limit;

    const conditions = [eq(reviews.companyId, companyId)];
    const status = req.query['status'] as string | undefined;
    const stage = req.query['stage'] as string | undefined;
    if (status) conditions.push(eq(reviews.status, status));
    if (stage) conditions.push(eq(reviews.stage, stage));

    const where = and(...conditions);

    const [rows, [countRow]] = await Promise.all([
      db.select().from(reviews).where(where).limit(limit).offset(offset).orderBy(reviews.createdAt),
      db.select({ total: count() }).from(reviews).where(where),
    ]);

    paginated(res, rows.map(formatReview), { page, limit, total: Number(countRow?.total ?? 0) });
  } catch (e) {
    next(e);
  }
});

// GET /companies/:companyId/reviews/:reviewId — Detail
router.get('/companies/:companyId/reviews/:reviewId', validateCompanyOwnership, async (req, res, next) => {
  try {
    const [review] = await db
      .select()
      .from(reviews)
      .where(
        and(eq(reviews.id, param(req, 'reviewId')), eq(reviews.companyId, param(req, 'companyId'))),
      );
    if (!review) return notFound(res, 'Review');
    ok(res, formatReview(review));
  } catch (e) {
    next(e);
  }
});

// POST /companies/:companyId/reviews/:reviewId/approve
const approveSchema = z.object({
  comment: z.string().optional(),
});

router.post(
  '/companies/:companyId/reviews/:reviewId/approve',
  validateCompanyOwnership,
  validate(approveSchema),
  async (req, res, next) => {
    try {
      const reviewId = param(req, 'reviewId');
      const companyId = param(req, 'companyId');
      const body = req.body as z.infer<typeof approveSchema>;

      const [review] = await db
        .select()
        .from(reviews)
        .where(and(eq(reviews.id, reviewId), eq(reviews.companyId, companyId)));
      if (!review) return notFound(res, 'Review');

      if (review.status !== 'pending') {
        return err(res, 400, 'ALREADY_DECIDED', `Review already ${review.status}`);
      }

      const comments = (review.comments ?? []) as Array<{ author: string; content: string; timestamp: string }>;
      if (body.comment) {
        comments.push({
          author: 'reviewer',
          content: body.comment,
          timestamp: new Date().toISOString(),
        });
      }

      const [updated] = await db
        .update(reviews)
        .set({ status: 'passed', comments, updatedAt: new Date() })
        .where(eq(reviews.id, reviewId))
        .returning();

      // If peer_review passed, optionally create human_gate
      if (review.stage === 'peer_review') {
        // Check if human gate is needed (configurable — for now skip)
        // await createHumanGate(companyId, review.taskId);
      }

      ok(res, formatReview(updated!));
    } catch (e) {
      next(e);
    }
  },
);

// POST /companies/:companyId/reviews/:reviewId/reject
const rejectSchema = z.object({
  comment: z.string().min(1),
});

router.post(
  '/companies/:companyId/reviews/:reviewId/reject',
  validateCompanyOwnership,
  validate(rejectSchema),
  async (req, res, next) => {
    try {
      const reviewId = param(req, 'reviewId');
      const body = req.body as z.infer<typeof rejectSchema>;

      const [review] = await db
        .select()
        .from(reviews)
        .where(and(eq(reviews.id, reviewId), eq(reviews.companyId, param(req, 'companyId'))));
      if (!review) return notFound(res, 'Review');

      if (review.status !== 'pending') {
        return err(res, 400, 'ALREADY_DECIDED', `Review already ${review.status}`);
      }

      const comments = (review.comments ?? []) as Array<{ author: string; content: string; timestamp: string }>;
      comments.push({
        author: 'reviewer',
        content: body.comment,
        timestamp: new Date().toISOString(),
      });

      const [updated] = await db
        .update(reviews)
        .set({ status: 'failed', comments, updatedAt: new Date() })
        .where(eq(reviews.id, reviewId))
        .returning();

      ok(res, formatReview(updated!));
    } catch (e) {
      next(e);
    }
  },
);

// --- Helper ---

type ReviewRow = typeof reviews.$inferSelect;

function formatReview(row: ReviewRow) {
  return {
    id: row.id,
    company_id: row.companyId,
    task_id: row.taskId,
    stage: row.stage,
    status: row.status,
    reviewer_agent_id: row.reviewerAgentId,
    comments: row.comments,
    created_at: row.createdAt?.toISOString() ?? null,
    updated_at: row.updatedAt?.toISOString() ?? null,
  };
}

export { router as reviewsRouter };

import { Router } from 'express';
import { z } from 'zod';
import { eq } from '@buildcrew/db';
import { db, subscriptions, users } from '@buildcrew/db';
import { validate } from '../lib/validate.js';
import { ok } from '../lib/response.js';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { PLAN_FEATURES } from '../middleware/plan-guard.js';

const router = Router();

// GET /plans — Available plans + features
router.get('/plans', (_req, res) => {
  ok(res, PLAN_FEATURES);
});

// GET /users/me/subscription — Current subscription
router.get('/users/me/subscription', authMiddleware, async (req, res, next) => {
  try {
    const userId = getUser(req).userId;
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));

    if (!sub) {
      return ok(res, {
        plan: 'free',
        status: 'active',
        current_period_start: null,
        current_period_end: null,
        cancel_at_period_end: false,
      });
    }

    ok(res, {
      id: sub.id,
      plan: sub.plan,
      status: sub.status,
      current_period_start: sub.currentPeriodStart?.toISOString() ?? null,
      current_period_end: sub.currentPeriodEnd?.toISOString() ?? null,
      cancel_at_period_end: sub.cancelAtPeriodEnd,
      created_at: sub.createdAt?.toISOString() ?? null,
    });
  } catch (e) {
    next(e);
  }
});

// POST /users/me/subscription/upgrade
const upgradeSchema = z.object({
  plan: z.enum(['pro', 'team']),
});

router.post('/users/me/subscription/upgrade', authMiddleware, validate(upgradeSchema), async (req, res, next) => {
  try {
    const userId = getUser(req).userId;
    const { plan } = req.body as z.infer<typeof upgradeSchema>;

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Upsert subscription
    const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));

    if (existing) {
      await db
        .update(subscriptions)
        .set({ plan, status: 'active', currentPeriodStart: now, currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false, updatedAt: now })
        .where(eq(subscriptions.id, existing.id));
    } else {
      await db.insert(subscriptions).values({
        userId, plan, status: 'active',
        currentPeriodStart: now, currentPeriodEnd: periodEnd,
      });
    }

    // Update user.plan
    await db.update(users).set({ plan }).where(eq(users.id, userId));

    ok(res, { plan, message: `Upgraded to ${plan.charAt(0).toUpperCase() + plan.slice(1)}` });
  } catch (e) {
    next(e);
  }
});

// POST /users/me/subscription/cancel
router.post('/users/me/subscription/cancel', authMiddleware, async (req, res, next) => {
  try {
    const userId = getUser(req).userId;

    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    if (!sub) return ok(res, { plan: 'free', message: 'No active subscription to cancel' });

    await db
      .update(subscriptions)
      .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id));

    ok(res, {
      plan: sub.plan,
      cancel_at_period_end: true,
      current_period_end: sub.currentPeriodEnd?.toISOString() ?? null,
      message: 'Subscription will cancel at end of current period',
    });
  } catch (e) {
    next(e);
  }
});

export { router as subscriptionsRouter };

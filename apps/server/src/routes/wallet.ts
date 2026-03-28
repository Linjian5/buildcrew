import { Router } from 'express';
import { z } from 'zod';
import { validate, parsePagination } from '../lib/validate.js';
import { ok, paginated } from '../lib/response.js';
import { getUser } from '../middleware/auth.js';
import { getBalance, topup, getTransactions } from '../services/wallet.js';

const router = Router();

// GET /users/me/wallet — Get balance
router.get('/users/me/wallet', async (req, res, next) => {
  try {
    const userId = getUser(req).userId;
    const wallet = await getBalance(userId);
    ok(res, {
      balance: wallet.balance,
      currency: wallet.currency,
    });
  } catch (e) {
    next(e);
  }
});

// GET /users/me/wallet/transactions — Transaction history
router.get('/users/me/wallet/transactions', async (req, res, next) => {
  try {
    const userId = getUser(req).userId;
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const type = req.query['type'] as 'topup' | 'consume' | 'refund' | undefined;

    const result = await getTransactions({ userId, type, page, limit });

    paginated(
      res,
      result.items.map((t) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        description: t.description,
        reference_id: t.referenceId,
        balance_after: Number(t.balanceAfter),
        created_at: t.createdAt?.toISOString() ?? null,
      })),
      { page, limit, total: result.total },
    );
  } catch (e) {
    next(e);
  }
});

// POST /users/me/wallet/topup — Add funds (test endpoint, no Stripe)
const topupSchema = z.object({
  amount: z.number().min(0.01).max(10000),
  description: z.string().max(200).optional(),
});

router.post('/users/me/wallet/topup', validate(topupSchema), async (req, res, next) => {
  try {
    const userId = getUser(req).userId;
    const body = req.body as z.infer<typeof topupSchema>;

    const result = await topup({
      userId,
      amount: body.amount,
      description: body.description ?? 'Manual topup',
    });

    ok(res, {
      balance: result.balance,
      currency: 'USD',
    });
  } catch (e) {
    next(e);
  }
});

export { router as walletRouter };

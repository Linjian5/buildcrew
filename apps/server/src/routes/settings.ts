import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { eq, sql, count } from '@buildcrew/db';
import { db, users, apiKeys, companies, modelApiKeys } from '@buildcrew/db';
import { validate } from '../lib/validate.js';
import { ok, notFound } from '../lib/response.js';
import { param } from '../lib/params.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const router = Router();

// GET /users/me
router.get('/users/me', authMiddleware, async (req, res, next) => {
  try {
    const userId = getUser(req).userId;
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return notFound(res, 'User');

    // Enrich with counts and usage
    const [companiesCount] = await db.select({ total: count() }).from(companies).where(eq(companies.userId, userId));
    const [keysCount] = await db.select({ total: count() }).from(modelApiKeys).where(eq(modelApiKeys.userId, userId));
    const [monthUsage] = await db.execute(
      sql`SELECT COALESCE(SUM(total_tokens), 0) as tokens, COALESCE(SUM(cost_usd::numeric), 0) as cost_usd
          FROM usage_records WHERE user_id = ${userId} AND created_at >= DATE_TRUNC('month', NOW())`,
    );
    const mu = monthUsage as unknown as Record<string, string>;

    ok(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatarUrl,
      plan: user.plan,
      created_at: user.createdAt?.toISOString() ?? null,
      companies_count: Number(companiesCount?.total ?? 0),
      model_keys_count: Number(keysCount?.total ?? 0),
      usage_this_month: {
        tokens: Number(mu['tokens'] ?? 0),
        cost_usd: Number(Number(mu['cost_usd'] ?? 0).toFixed(6)),
      },
    });
  } catch (e) {
    next(e);
  }
});

// PUT /users/me
const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatar_url: z.string().url().nullable().optional(),
});

router.put('/users/me', authMiddleware, validate(updateProfileSchema), async (req, res, next) => {
  try {
    const userId = getUser(req).userId;
    const body = req.body as z.infer<typeof updateProfileSchema>;
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates['name'] = body.name;
    if (body.avatar_url !== undefined) updates['avatarUrl'] = body.avatar_url;

    const [user] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
    if (!user) return notFound(res, 'User');

    ok(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatarUrl,
      plan: user.plan,
    });
  } catch (e) {
    next(e);
  }
});

// POST /api-keys — Create
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
});

router.post('/api-keys', authMiddleware, validate(createApiKeySchema), async (req, res, next) => {
  try {
    const userId = getUser(req).userId;
    const body = req.body as z.infer<typeof createApiKeySchema>;

    // Generate key: bc_sk_ + 40 random hex chars
    const rawKey = `bc_sk_${crypto.randomBytes(20).toString('hex')}`;
    const keyHash = await bcrypt.hash(rawKey, 10);
    const keyPrefix = rawKey.slice(0, 12);

    const [key] = await db
      .insert(apiKeys)
      .values({ userId, name: body.name, keyHash, keyPrefix })
      .returning();

    // Return full key only on creation
    ok(res, {
      id: key!.id,
      name: key!.name,
      key: rawKey, // only returned once!
      key_prefix: keyPrefix,
      created_at: key!.createdAt?.toISOString() ?? null,
    }, 201);
  } catch (e) {
    next(e);
  }
});

// GET /api-keys — List (masked)
router.get('/api-keys', authMiddleware, async (req, res, next) => {
  try {
    const userId = getUser(req).userId;
    const rows = await db.select().from(apiKeys).where(eq(apiKeys.userId, userId));

    ok(res, rows.map((k) => ({
      id: k.id,
      name: k.name,
      key_prefix: k.keyPrefix,
      last_used_at: k.lastUsedAt?.toISOString() ?? null,
      created_at: k.createdAt?.toISOString() ?? null,
    })));
  } catch (e) {
    next(e);
  }
});

// DELETE /api-keys/:id
router.delete('/api-keys/:id', authMiddleware, async (req, res, next) => {
  try {
    const userId = getUser(req).userId;
    const keyId = param(req, 'id');

    const [key] = await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
      .returning();

    if (!key) return notFound(res, 'API key');
    ok(res, { id: key.id, deleted: true });
  } catch (e) {
    next(e);
  }
});

// Need to import 'and'
import { and } from '@buildcrew/db';

export { router as settingsRouter };

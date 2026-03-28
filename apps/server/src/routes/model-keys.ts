import { Router } from 'express';
import { z } from 'zod';
import { eq, and } from '@buildcrew/db';
import { db, modelApiKeys } from '@buildcrew/db';
import { validate } from '../lib/validate.js';
import { ok, notFound } from '../lib/response.js';
import { param } from '../lib/params.js';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { encrypt, decrypt, maskApiKey } from '../lib/encryption.js';
import { MODEL_PROVIDERS } from '../lib/providers.js';
import { validateApiKey } from '../lib/validate-key.js';

const router = Router();

const validProviders = Object.keys(MODEL_PROVIDERS);

const createModelKeySchema = z.object({
  provider: z.string().refine((v) => validProviders.includes(v), { message: 'Unknown provider' }),
  display_name: z.string().min(1).max(100),
  api_key: z.string().min(1).max(500),
  api_endpoint: z.string().url().nullable().optional(),
});

const updateModelKeySchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  api_endpoint: z.string().url().nullable().optional(),
  is_default: z.boolean().optional(),
});

// POST /users/me/model-keys — Add a model key
router.post('/users/me/model-keys', authMiddleware, validate(createModelKeySchema), async (req, res, next) => {
  try {
    const userId = getUser(req).userId;
    const body = req.body as z.infer<typeof createModelKeySchema>;

    const apiKeyEncrypted = encrypt(body.api_key);

    // Check if this should be default (first key for this provider)
    const [existing] = await db
      .select()
      .from(modelApiKeys)
      .where(and(eq(modelApiKeys.userId, userId), eq(modelApiKeys.provider, body.provider)));
    const isDefault = !existing;

    const [key] = await db
      .insert(modelApiKeys)
      .values({
        userId,
        provider: body.provider,
        displayName: body.display_name,
        apiKeyEncrypted,
        apiEndpoint: body.api_endpoint ?? null,
        isDefault,
      })
      .returning();

    // Auto-validate (non-blocking — save first, validate after)
    const validation = await validateApiKey(body.provider, body.api_key, body.api_endpoint).catch(() => ({ valid: false, error: 'validation failed' }));
    await db
      .update(modelApiKeys)
      .set({ isValid: validation.valid, lastValidatedAt: new Date(), updatedAt: new Date() })
      .where(eq(modelApiKeys.id, key!.id));

    const result = formatModelKey({ ...key!, isValid: validation.valid, lastValidatedAt: new Date() }, body.api_key);
    ok(res, { ...result, validation }, 201);
  } catch (e) {
    next(e);
  }
});

// GET /users/me/model-keys — List (masked)
router.get('/users/me/model-keys', authMiddleware, async (req, res, next) => {
  try {
    const userId = getUser(req).userId;
    const rows = await db
      .select()
      .from(modelApiKeys)
      .where(eq(modelApiKeys.userId, userId))
      .orderBy(modelApiKeys.provider, modelApiKeys.createdAt);

    const data = rows.map((r) => {
      const rawKey = decrypt(r.apiKeyEncrypted);
      return formatModelKey(r, rawKey, true);
    });

    ok(res, data);
  } catch (e) {
    next(e);
  }
});

// PUT /users/me/model-keys/:id — Update
router.put(
  '/users/me/model-keys/:id',
  authMiddleware,
  validate(updateModelKeySchema),
  async (req, res, next) => {
    try {
      const userId = getUser(req).userId;
      const keyId = param(req, 'id');
      const body = req.body as z.infer<typeof updateModelKeySchema>;

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (body.display_name !== undefined) updates['displayName'] = body.display_name;
      if (body.api_endpoint !== undefined) updates['apiEndpoint'] = body.api_endpoint;

      // Handle is_default: unset other defaults for same provider
      if (body.is_default === true) {
        const [current] = await db
          .select()
          .from(modelApiKeys)
          .where(and(eq(modelApiKeys.id, keyId), eq(modelApiKeys.userId, userId)));
        if (current) {
          await db
            .update(modelApiKeys)
            .set({ isDefault: false })
            .where(and(eq(modelApiKeys.userId, userId), eq(modelApiKeys.provider, current.provider)));
        }
        updates['isDefault'] = true;
      } else if (body.is_default === false) {
        updates['isDefault'] = false;
      }

      const [key] = await db
        .update(modelApiKeys)
        .set(updates)
        .where(and(eq(modelApiKeys.id, keyId), eq(modelApiKeys.userId, userId)))
        .returning();

      if (!key) return notFound(res, 'Model API key');

      const rawKey = decrypt(key.apiKeyEncrypted);
      ok(res, formatModelKey(key, rawKey, true));
    } catch (e) {
      next(e);
    }
  },
);

// DELETE /users/me/model-keys/:id
router.delete('/users/me/model-keys/:id', authMiddleware, async (req, res, next) => {
  try {
    const userId = getUser(req).userId;
    const keyId = param(req, 'id');

    const [key] = await db
      .delete(modelApiKeys)
      .where(and(eq(modelApiKeys.id, keyId), eq(modelApiKeys.userId, userId)))
      .returning();

    if (!key) return notFound(res, 'Model API key');
    ok(res, { id: key.id, deleted: true });
  } catch (e) {
    next(e);
  }
});

// POST /users/me/model-keys/:id/validate — Validate key
router.post('/users/me/model-keys/:id/validate', authMiddleware, async (req, res, next) => {
  try {
    const userId = getUser(req).userId;
    const keyId = param(req, 'id');

    const [key] = await db
      .select()
      .from(modelApiKeys)
      .where(and(eq(modelApiKeys.id, keyId), eq(modelApiKeys.userId, userId)));

    if (!key) return notFound(res, 'Model API key');

    // Decrypt and validate by making a real API call
    let apiKey: string;
    try {
      apiKey = decrypt(key.apiKeyEncrypted);
    } catch {
      await db.update(modelApiKeys).set({ isValid: false, updatedAt: new Date() }).where(eq(modelApiKeys.id, keyId));
      return ok(res, { id: key.id, is_valid: false, error: 'Failed to decrypt key', validated_at: new Date().toISOString() });
    }

    const validation = await validateApiKey(key.provider, apiKey, key.apiEndpoint).catch(() => ({ valid: false, error: 'validation request failed' }));

    await db
      .update(modelApiKeys)
      .set({ isValid: validation.valid, lastValidatedAt: new Date(), updatedAt: new Date() })
      .where(eq(modelApiKeys.id, keyId));

    ok(res, { id: key.id, is_valid: validation.valid, error: validation.valid ? undefined : validation.error, validated_at: new Date().toISOString() });
  } catch (e) {
    next(e);
  }
});

// --- Helpers ---

type ModelKeyRow = typeof modelApiKeys.$inferSelect;

function formatModelKey(row: ModelKeyRow, rawKey: string, masked = false) {
  return {
    id: row.id,
    provider: row.provider,
    provider_name: MODEL_PROVIDERS[row.provider]?.name ?? row.provider,
    display_name: row.displayName,
    api_key_masked: masked ? maskApiKey(rawKey) : rawKey,
    api_endpoint: row.apiEndpoint,
    is_default: row.isDefault,
    is_valid: row.isValid,
    last_validated_at: row.lastValidatedAt?.toISOString() ?? null,
    created_at: row.createdAt?.toISOString() ?? null,
    updated_at: row.updatedAt?.toISOString() ?? null,
  };
}

export { router as modelKeysRouter };

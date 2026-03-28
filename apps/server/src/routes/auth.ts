import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from '@buildcrew/db';
import { db, users } from '@buildcrew/db';
import { validate } from '../lib/validate.js';
import { ok, err } from '../lib/response.js';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// POST /auth/register
router.post('/auth/register', validate(registerSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof registerSchema>;

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email));
    if (existing) return err(res, 409, 'EMAIL_EXISTS', 'Email already registered');

    const passwordHash = await bcrypt.hash(body.password, 12);
    const [user] = await db
      .insert(users)
      .values({ name: body.name, email: body.email, passwordHash })
      .returning();

    if (!user) return err(res, 500, 'CREATE_FAILED', 'Failed to create user');

    // B-06: Auto-create wallet with initial balance
    const { ensureWallet } = await import('../services/wallet.js');
    await ensureWallet(user.id).catch(() => {});

    const payload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    ok(res, {
      user: { id: user.id, name: user.name, email: user.email, plan: user.plan },
      accessToken,
      refreshToken,
    }, 201);
  } catch (e) {
    next(e);
  }
});

// POST /auth/login
router.post('/auth/login', validate(loginSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof loginSchema>;

    const [user] = await db.select().from(users).where(eq(users.email, body.email));
    if (!user) return err(res, 401, 'INVALID_CREDENTIALS', 'Invalid credentials');

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) return err(res, 401, 'INVALID_CREDENTIALS', 'Invalid credentials');

    const payload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    ok(res, {
      user: { id: user.id, name: user.name, email: user.email, plan: user.plan },
      accessToken,
      refreshToken,
    });
  } catch (e) {
    next(e);
  }
});

// POST /auth/refresh
router.post('/auth/refresh', validate(refreshSchema), async (req, res, _next) => {
  try {
    const { refreshToken } = req.body as z.infer<typeof refreshSchema>;

    const decoded = verifyToken(refreshToken);
    const payload = { userId: decoded.userId, email: decoded.email };
    const accessToken = generateAccessToken(payload);

    ok(res, { accessToken });
  } catch {
    err(res, 401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
  }
});

export { router as authRouter };

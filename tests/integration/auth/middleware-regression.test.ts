import { describe, it, expect, beforeEach } from 'vitest';
import { post, get, getTestToken } from '../../helpers/api';
import { createCompanyPayload } from '../../helpers/fixtures';
import { resetDatabase } from '../../helpers/db';

describe('Auth Middleware Regression', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  // ─── Public endpoints (no token required) ───────────────

  describe('Public endpoints', () => {
    it('GET /health should return 200 without token', async () => {
      const res = await get('/health');
      expect(res.status).toBe(200);
      expect(res.body.data!.status).toBe('ok');
    });

    it('POST /auth/login should accept requests without token', async () => {
      const res = await post('/auth/login', { email: 'nobody@example.com', password: 'wrongpass' });
      // 401 for invalid credentials, NOT for missing auth header
      expect(res.status).toBe(401);
      expect(res.body.error!.code).toBe('INVALID_CREDENTIALS');
    });

    it('POST /auth/register should accept requests without token', async () => {
      const res = await post('/auth/register', {
        name: 'Public User',
        email: `pub-${Date.now()}@test.dev`,
        password: 'SecurePass123!',
      });
      expect(res.status).toBe(201);
    });

    it('POST /auth/refresh should accept requests without token', async () => {
      const res = await post('/auth/refresh', { refreshToken: 'invalid' });
      expect(res.status).toBe(401);
      expect(res.body.error!.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  // ─── Protected endpoints without token → 401 ───────────

  describe('Protected endpoints without token → 401', () => {
    it('GET /companies → 401', async () => {
      const res = await get('/companies');
      expect(res.status).toBe(401);
      expect(res.body.error!.code).toBe('UNAUTHORIZED');
    });

    it('GET /companies/:id/agents → 401', async () => {
      const res = await get('/companies/00000000-0000-4000-8000-000000000000/agents');
      expect(res.status).toBe(401);
    });

    it('GET /companies/:id/tasks → 401', async () => {
      const res = await get('/companies/00000000-0000-4000-8000-000000000000/tasks');
      expect(res.status).toBe(401);
    });

    it('GET /users/me → 401', async () => {
      const res = await get('/users/me');
      expect(res.status).toBe(401);
    });

    it('GET /users/me/model-keys → 401', async () => {
      const res = await get('/users/me/model-keys');
      expect(res.status).toBe(401);
    });
  });

  // ─── Valid token → 200 ─────────────────────────────────

  describe('Valid token → access granted', () => {
    it('GET /companies with valid token → 200', async () => {
      const token = await getTestToken();
      const res = await get('/companies', { token });
      expect(res.status).toBe(200);
    });

    it('POST /companies with valid token → 201', async () => {
      const token = await getTestToken();
      const res = await post('/companies', createCompanyPayload(), { token });
      expect(res.status).toBe(201);
    });

    it('GET /users/me with valid token → 200', async () => {
      const token = await getTestToken();
      const res = await get('/users/me', { token });
      expect(res.status).toBe(200);
    });
  });

  // ─── Invalid/expired token → 401 ───────────────────────

  describe('Invalid/expired token → 401', () => {
    it('invalid token string → 401', async () => {
      const res = await get('/companies', { token: 'not-a-real-jwt' });
      expect(res.status).toBe(401);
    });

    it('expired JWT → 401', async () => {
      // Malformed JWT with exp=1 (long expired)
      const res = await get('/companies', {
        token: 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.invalid-sig',
      });
      expect(res.status).toBe(401);
    });
  });
});

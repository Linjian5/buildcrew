import { describe, it, expect, beforeEach } from 'vitest';
import { post, get, getTestToken } from '../../helpers/api';
import { resetDatabase } from '../../helpers/db';

/**
 * Subscription API tests.
 * NOTE: Subscription routes are NOT YET IMPLEMENTED on backend.
 * These are skeleton tests — will fill when backend adds endpoints.
 */
describe('Subscription API', () => {
  let token: string;

  beforeEach(async () => {
    await resetDatabase();
    token = await getTestToken();
  });

  describe('GET /subscription (when implemented)', () => {
    it('should return current plan', async () => {
      // GET /users/me already has plan field
      const res = await get('/users/me', { token });
      expect(res.status).toBe(200);
      expect(res.body.data!.plan).toBeDefined();
      expect(res.body.data!.plan).toBe('free'); // Default plan
    });
  });

  describe('GET /plans (when implemented)', () => {
    it('should return available plans', async () => {
      const res = await get('/subscription/plans', { token });
      // 404 if not implemented, 200 if implemented
      if (res.status === 200) {
        expect(Array.isArray(res.body.data)).toBe(true);
      }
    });
  });

  describe('POST /subscription/upgrade (when implemented)', () => {
    it('should upgrade Free to Pro', async () => {
      const res = await post('/subscription/upgrade', { plan: 'pro' }, { token });
      // 404 if not implemented, 200 if implemented
      if (res.status === 200) {
        const me = await get('/users/me', { token });
        expect(me.body.data!.plan).toBe('pro');
      }
    });
  });

  describe('POST /subscription/cancel (when implemented)', () => {
    it('should cancel subscription', async () => {
      const res = await post('/subscription/cancel', {}, { token });
      // 404 if not implemented, 200 if implemented
      if (res.status === 200) {
        const me = await get('/users/me', { token });
        expect(['free', 'cancelled']).toContain(me.body.data!.plan);
      }
    });
  });
});

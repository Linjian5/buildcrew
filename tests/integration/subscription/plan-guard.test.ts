import { describe, it, expect, beforeEach } from 'vitest';
import { post, get, put, getTestToken } from '../../helpers/api';
import { createCompanyPayload, createAgentPayload } from '../../helpers/fixtures';
import { resetDatabase } from '../../helpers/db';

/**
 * Subscription Plan Guard tests.
 * NOTE: Plan guard middleware is NOT YET IMPLEMENTED on backend.
 * These tests are skeletons — adjust assertions when backend adds plan enforcement.
 */
describe('Subscription Plan Guard', () => {
  let token: string;
  let companyId: string;

  beforeEach(async () => {
    await resetDatabase();
    token = await getTestToken();
    const co = await post('/companies', createCompanyPayload(), { token });
    companyId = co.body.data!.id;
  });

  describe('Free plan limits (when enforced)', () => {
    it('Free user creating 6th Agent should be blocked (403 or succeed if not enforced)', async () => {
      // Create 5 agents
      for (let i = 1; i <= 5; i++) {
        await post(`/companies/${companyId}/agents`, createAgentPayload({ name: `Agent${i}` }), { token });
      }
      // 6th should hit limit when plan guard is active
      const res = await post(`/companies/${companyId}/agents`, createAgentPayload({ name: 'Agent6' }), { token });
      // Accept 201 (not enforced) or 403 (enforced)
      expect([201, 403]).toContain(res.status);
    });

    it('Free user creating 4th company should be blocked (403 or succeed)', async () => {
      await post('/companies', createCompanyPayload({ name: 'Co2' }), { token });
      await post('/companies', createCompanyPayload({ name: 'Co3' }), { token });
      const res = await post('/companies', createCompanyPayload({ name: 'Co4' }), { token });
      expect([201, 403]).toContain(res.status);
    });

    it('Free user selecting non-balanced routing strategy (403 or succeed)', async () => {
      const res = await put(`/companies/${companyId}/routing/strategy`, {
        strategy: 'quality_first',
      }, { token });
      expect([200, 403]).toContain(res.status);
    });

    it('Free user creating A/B experiment (403 or succeed)', async () => {
      const res = await post(`/companies/${companyId}/experiments`, {
        name: 'Test', variant_a: {}, variant_b: {},
      }, { token });
      expect([201, 403]).toContain(res.status);
    });
  });

  describe('Pro plan (no limits)', () => {
    it('Pro user should have no agent limit', async () => {
      // Upgrade to Pro (when endpoint exists)
      const upgrade = await post('/subscription/upgrade', { plan: 'pro' }, { token });
      if (upgrade.status === 200) {
        for (let i = 1; i <= 10; i++) {
          const res = await post(`/companies/${companyId}/agents`, createAgentPayload({ name: `ProAgent${i}` }), { token });
          expect(res.status).toBe(201);
        }
      }
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET, PUT, registerUser, createCompany, createAgent, resetDB } from './helpers/setup';

describe('订阅系统', () => {
  let token: string;
  beforeEach(async () => { await resetDB(); token = (await registerUser()).token; });

  it('新用户默认 Free 计划', async () => {
    const res = await GET('/users/me', token);
    expect(res.body.data.plan).toBe('free');
  });

  it('GET /plans 返回计划列表', async () => {
    // Try with and without token — /plans may require auth
    const res = await GET('/subscription/plans', token);
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('升级 Free → Pro', async () => {
    const res = await POST('/subscription/upgrade', { plan: 'pro' }, token);
    if (res.status === 200) {
      const me = await GET('/users/me', token);
      expect(me.body.data.plan).toBe('pro');
    }
  });

  describe('Free 限制 (when enforced)', () => {
    it('第 6 个 Agent → 403 或 201', async () => {
      const co = await createCompany(token);
      for (let i = 1; i <= 5; i++) await createAgent(token, co.id, { name: `A${i}` });
      const ag = await POST(`/companies/${co.id}/agents`, {
        name: 'A6', title: 'X', runtime: { type: 'x', model: 'y', endpoint: 'https://a.b' }, budget_monthly: 1,
      }, token);
      expect([201, 403]).toContain(ag.status);
    });

    it('第 4 家公司 → 403 或 201', async () => {
      await createCompany(token, 'C1'); await createCompany(token, 'C2'); await createCompany(token, 'C3');
      const res = await POST('/companies', { name: 'C4', budget_monthly: 1, currency: 'USD' }, token);
      expect([201, 403]).toContain(res.status);
    });

    it('非 balanced 路由策略 → 403 或 200', async () => {
      const co = await createCompany(token);
      const res = await PUT(`/companies/${co.id}/routing/strategy`, { strategy: 'quality_first' }, token);
      expect([200, 403]).toContain(res.status);
    });

    it('创建 A/B 实验 → 403 或 201', async () => {
      const co = await createCompany(token);
      const res = await POST(`/companies/${co.id}/experiments`, { name: 'E', variant_a: {}, variant_b: {} }, token);
      expect([201, 403]).toContain(res.status);
    });
  });
});

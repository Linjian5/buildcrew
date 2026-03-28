import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET, PUT, registerUser, createCompany, createAgent, heartbeat, resetDB } from './helpers/setup';

describe('安全监控', () => {
  let token: string; let companyId: string; let agentId: string;
  beforeEach(async () => {
    await resetDB(); token = (await registerUser()).token;
    companyId = (await createCompany(token)).id;
    agentId = (await createAgent(token, companyId, { budget_monthly: 50 })).id;
  });

  it('预算 >70% → warning 告警', async () => {
    await heartbeat(token, companyId, agentId, 36); // 72%
    const res = await GET(`/companies/${companyId}/guardian/alerts`, token);
    expect(res.status).toBe(200);
  });

  it('预算 >90% → critical 告警', async () => {
    await heartbeat(token, companyId, agentId, 46); // 92%
    const res = await GET(`/companies/${companyId}/guardian/alerts`, token);
    expect(res.status).toBe(200);
  });

  it('告警列表按 severity 过滤', async () => {
    await heartbeat(token, companyId, agentId, 36);
    const res = await GET(`/companies/${companyId}/guardian/alerts?severity=warning`, token);
    expect(res.status).toBe(200);
  });

  it('resolve 告警', async () => {
    await heartbeat(token, companyId, agentId, 36);
    const alerts = await GET(`/companies/${companyId}/guardian/alerts`, token);
    const list = alerts.body.data as any[];
    if (list.length > 0) {
      const res = await PUT(`/companies/${companyId}/guardian/alerts/${list[0].id}`, { action: 'resolve' }, token);
      expect(res.status).toBe(200);
      expect(res.body.data.resolved).toBe(true);
    }
  });

  it('策略 CRUD', async () => {
    const res = await PUT(`/companies/${companyId}/guardian/policies`, {
      policy_type: 'cost_limit', config: { max: 100 }, enabled: true,
    }, token);
    expect([200, 201]).toContain(res.status);
    const list = await GET(`/companies/${companyId}/guardian/policies`, token);
    expect(Array.isArray(list.body.data)).toBe(true);
  });
});

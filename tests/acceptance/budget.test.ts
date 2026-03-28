import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET, registerUser, createCompany, createAgent, heartbeat, resetDB } from './helpers/setup';

describe('预算系统', () => {
  let token: string; let companyId: string; let agentId: string;
  beforeEach(async () => {
    await resetDB(); token = (await registerUser()).token;
    companyId = (await createCompany(token)).id;
    agentId = (await createAgent(token, companyId, { budget_monthly: 10 })).id;
  });

  it('正常扣减', async () => {
    await heartbeat(token, companyId, agentId, 0.5);
    const d = await GET(`/companies/${companyId}/agents/${agentId}`, token);
    expect(d.body.data.budget_spent).toBeCloseTo(0.5, 1);
  });

  it('超支阻断 → 不分配新任务', async () => {
    await heartbeat(token, companyId, agentId, 10.0);
    const res = await heartbeat(token, companyId, agentId, 0);
    expect(res.body.data.task).toBeNull();
  });

  it('并发扣减不超扣', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => heartbeat(token, companyId, agentId, 2.0)));
    results.forEach(r => expect(r.status).toBe(200));
    const d = await GET(`/companies/${companyId}/agents/${agentId}`, token);
    expect(d.body.data.budget_spent).toBeLessThanOrEqual(10.0);
  });

  it('GET /budget 返回正确汇总', async () => {
    await heartbeat(token, companyId, agentId, 3.0);
    const res = await GET(`/companies/${companyId}/budget`, token);
    expect(res.status).toBe(200);
    expect(res.body.data.company_id).toBe(companyId);
  });

  it('GET /budget/agents 返回各 Agent 明细', async () => {
    await heartbeat(token, companyId, agentId, 1.0);
    const res = await GET(`/companies/${companyId}/budget/agents`, token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

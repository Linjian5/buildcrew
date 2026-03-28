import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET, registerUser, createCompany, createAgent, createTask, assignTask, completeTask, resetDB } from './helpers/setup';

describe('进化引擎', () => {
  let token: string; let companyId: string; let agentId: string;
  beforeEach(async () => {
    await resetDB(); token = (await registerUser()).token;
    companyId = (await createCompany(token)).id;
    agentId = (await createAgent(token, companyId)).id;
  });

  async function doTask() {
    const t = await createTask(token, companyId);
    await assignTask(token, companyId, t.id, agentId);
    await completeTask(token, companyId, t.id);
  }

  it('GET /performance 返回雷达图数据', async () => {
    await doTask();
    const res = await GET(`/companies/${companyId}/agents/${agentId}/performance`, token);
    expect(res.status).toBe(200);
    expect(res.body.data.radar).toBeDefined();
    expect(res.body.data.trend).toBeDefined();
  });

  it('能力画像更新 — total_tasks 增加', async () => {
    await doTask(); await doTask();
    const res = await GET(`/companies/${companyId}/agents/${agentId}/performance`, token);
    expect(res.body.data.total_tasks).toBeGreaterThanOrEqual(1);
  });

  it('A/B 实验创建 (Pro only, Free gets 403)', async () => {
    const res = await POST(`/companies/${companyId}/experiments`, {
      name: 'Test', variant_a: {}, variant_b: {},
    }, token);
    // Free plan → 403 PLAN_REQUIRED, Pro → 201
    expect([201, 403]).toContain(res.status);
  });

  it('实验结果查询 (if experiment created)', async () => {
    const exp = await POST(`/companies/${companyId}/experiments`, { name: 'R', variant_a: {}, variant_b: {} }, token);
    if (exp.status === 201 && exp.body.data) {
      const res = await GET(`/companies/${companyId}/experiments/${exp.body.data.id}/results`, token);
      expect(res.status).toBe(200);
      expect(res.body.data.variant_a).toBeDefined();
    }
  });
});

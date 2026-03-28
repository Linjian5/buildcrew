import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET, PUT, registerUser, createCompany, createAgent, createTask, resetDB } from './helpers/setup';

describe('智能路由', () => {
  let token: string; let companyId: string;
  beforeEach(async () => {
    await resetDB(); token = (await registerUser()).token;
    companyId = (await createCompany(token)).id;
  });

  it('balanced 策略 → 返回分配结果', async () => {
    await createAgent(token, companyId);
    const t = await createTask(token, companyId);
    const res = await POST(`/companies/${companyId}/tasks/${t.id}/route`, {}, token);
    expect(res.status).toBe(200);
    expect(res.body.data.selected_agent_id).toBeDefined();
  });

  it('设置策略 + 路由', async () => {
    await PUT(`/companies/${companyId}/routing/strategy`, { strategy: 'quality_first' }, token);
    await createAgent(token, companyId);
    const t = await createTask(token, companyId);
    const res = await POST(`/companies/${companyId}/tasks/${t.id}/route`, {}, token);
    expect(res.status).toBe(200);
  });

  it('手动创建 Agent 前路由 → 使用自动创建的 CEO 或 422', async () => {
    const t = await createTask(token, companyId);
    const res = await POST(`/companies/${companyId}/tasks/${t.id}/route`, {}, token);
    // Backend auto-creates Aria (CEO) on company creation, so routing may succeed
    expect([200, 422]).toContain(res.status);
  });

  it('路由决策记录保存', async () => {
    await createAgent(token, companyId);
    const t = await createTask(token, companyId);
    await POST(`/companies/${companyId}/tasks/${t.id}/route`, {}, token);
    const res = await GET(`/companies/${companyId}/routing/decisions`, token);
    expect((res.body.data as unknown[]).length).toBeGreaterThanOrEqual(1);
  });
});

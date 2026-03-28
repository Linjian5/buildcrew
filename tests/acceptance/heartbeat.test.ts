import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET, registerUser, createCompany, createAgent, createTask, heartbeat, resetDB } from './helpers/setup';

describe('心跳引擎', () => {
  let token: string; let companyId: string; let agentId: string;
  beforeEach(async () => {
    await resetDB(); token = (await registerUser()).token;
    companyId = (await createCompany(token)).id;
    agentId = (await createAgent(token, companyId, { budget_monthly: 10 })).id;
  });

  it('idle Agent 心跳 + 有任务 → action=new_task', async () => {
    await createTask(token, companyId, 'Pending');
    const res = await heartbeat(token, companyId, agentId, 0);
    expect(res.status).toBe(200);
    expect(['new_task', 'execute_task']).toContain(res.body.data.action);
    expect(res.body.data.task).not.toBeNull();
  });

  it('idle Agent 心跳 + 无任务 → action=continue', async () => {
    const res = await heartbeat(token, companyId, agentId, 0);
    expect(['continue', 'idle']).toContain(res.body.data.action);
  });

  it('心跳更新 last_heartbeat_at', async () => {
    await heartbeat(token, companyId, agentId, 0);
    const detail = await GET(`/companies/${companyId}/agents/${agentId}`, token);
    expect(detail.body.data.last_heartbeat_at).not.toBeNull();
  });

  it('token_usage 累加到 budget_spent', async () => {
    await heartbeat(token, companyId, agentId, 0.5);
    await heartbeat(token, companyId, agentId, 0.3);
    const detail = await GET(`/companies/${companyId}/agents/${agentId}`, token);
    expect(detail.body.data.budget_spent).toBeCloseTo(0.8, 1);
  });

  it('预算耗尽 → action=stop/pause', async () => {
    await heartbeat(token, companyId, agentId, 10.0);
    const res = await heartbeat(token, companyId, agentId, 0);
    expect(['stop', 'pause']).toContain(res.body.data.action);
  });

  it('Agent 被 pause → action=pause', async () => {
    await POST(`/companies/${companyId}/agents/${agentId}/pause`, {}, token);
    const res = await heartbeat(token, companyId, agentId, 0);
    expect(res.body.data.action).toBe('pause');
  });
});

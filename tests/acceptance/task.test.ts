import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET, registerUser, createCompany, createAgent, createTask, assignTask, completeTask, resetDB } from './helpers/setup';

describe('任务管理', () => {
  let token: string; let companyId: string; let agentId: string;
  beforeEach(async () => {
    await resetDB(); token = (await registerUser()).token;
    companyId = (await createCompany(token)).id;
    agentId = (await createAgent(token, companyId)).id;
  });

  describe('CRUD', () => {
    it('创建任务 → status=backlog', async () => {
      const t = await createTask(token, companyId);
      expect(t.status).toBe('backlog');
    });

    it('分配任务 → status=in_progress', async () => {
      const t = await createTask(token, companyId);
      await assignTask(token, companyId, t.id, agentId);
      const detail = await GET(`/companies/${companyId}/tasks/${t.id}`, token);
      expect(detail.body.data.status).toBe('in_progress');
    });

    it('并发检出同一任务 → 1 成功 1 返回 409', async () => {
      const t = await createTask(token, companyId);
      const ag2 = await createAgent(token, companyId, { name: 'Agent2' });
      const [r1, r2] = await Promise.all([
        POST(`/companies/${companyId}/tasks/${t.id}/checkout`, { agent_id: agentId }, token),
        POST(`/companies/${companyId}/tasks/${t.id}/checkout`, { agent_id: ag2.id }, token),
      ]);
      expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    });

    it('完成任务 → completed_at 有值', async () => {
      const t = await createTask(token, companyId);
      await assignTask(token, companyId, t.id, agentId);
      await completeTask(token, companyId, t.id);
      const detail = await GET(`/companies/${companyId}/tasks/${t.id}`, token);
      expect(detail.body.data.completed_at).not.toBeNull();
      expect(detail.body.data.status).toBe('done');
    });
  });

  describe('状态机', () => {
    it('backlog → in_progress ✅', async () => {
      const t = await createTask(token, companyId);
      const res = await assignTask(token, companyId, t.id, agentId);
      expect(res.status).toBe(200);
    });

    it('in_progress → done (via complete) ✅', async () => {
      const t = await createTask(token, companyId);
      await assignTask(token, companyId, t.id, agentId);
      const res = await completeTask(token, companyId, t.id);
      expect(res.status).toBe(200);
    });

    it('backlog → done ❌ 400', async () => {
      const t = await createTask(token, companyId);
      const res = await completeTask(token, companyId, t.id);
      expect(res.status).toBe(400);
    });

    it('done → in_progress ❌ 400', async () => {
      const t = await createTask(token, companyId);
      await assignTask(token, companyId, t.id, agentId);
      await completeTask(token, companyId, t.id);
      const res = await assignTask(token, companyId, t.id, agentId);
      expect(res.status).toBe(400);
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET, registerUser, createCompany, createAgent, createTask, assignTask, completeTask, resetDB } from './helpers/setup';

describe('审查流水线', () => {
  let token: string; let companyId: string; let agentId: string;
  beforeEach(async () => {
    await resetDB(); token = (await registerUser()).token;
    companyId = (await createCompany(token)).id;
    agentId = (await createAgent(token, companyId)).id;
  });

  it('review 列表', async () => {
    const res = await GET(`/companies/${companyId}/reviews`, token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('approve review → passed', async () => {
    const t = await createTask(token, companyId);
    await assignTask(token, companyId, t.id, agentId);
    await completeTask(token, companyId, t.id);
    const reviews = await GET(`/companies/${companyId}/reviews`, token);
    const pending = (reviews.body.data as any[]).find((r: any) => r.status === 'pending');
    if (pending) {
      const res = await POST(`/companies/${companyId}/reviews/${pending.id}/approve`, { comment: 'Good' }, token);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('passed');
    }
  });

  it('reject review → failed', async () => {
    const t = await createTask(token, companyId);
    await assignTask(token, companyId, t.id, agentId);
    await completeTask(token, companyId, t.id);
    const reviews = await GET(`/companies/${companyId}/reviews`, token);
    const pending = (reviews.body.data as any[]).find((r: any) => r.status === 'pending');
    if (pending) {
      const res = await POST(`/companies/${companyId}/reviews/${pending.id}/reject`, { comment: 'Needs work' }, token);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('failed');
    }
  });
});

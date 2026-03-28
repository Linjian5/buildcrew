import { describe, it, expect, beforeEach } from 'vitest';
import { GET, registerUser, createCompany, createAgent, heartbeat, resetDB } from './helpers/setup';

describe('用量统计', () => {
  let token: string; let companyId: string; let agentId: string;
  beforeEach(async () => {
    await resetDB(); token = (await registerUser()).token;
    companyId = (await createCompany(token)).id;
    agentId = (await createAgent(token, companyId)).id;
  });

  it('GET /users/me/usage 返回汇总', async () => {
    await heartbeat(token, companyId, agentId, 0.05);
    const res = await GET('/users/me/usage', token);
    expect(res.status).toBe(200);
    expect(res.body.data.this_month).toBeDefined();
  });

  it('GET /usage/daily 返回每日趋势', async () => {
    const res = await GET('/users/me/usage/daily', token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('不同用户用量隔离', async () => {
    await heartbeat(token, companyId, agentId, 1.0);
    const b = await registerUser();
    const res = await GET('/users/me/usage', b.token);
    expect(res.body.data.total_tokens).toBe(0);
  });
});

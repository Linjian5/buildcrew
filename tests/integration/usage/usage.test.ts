import { describe, it, expect, beforeEach } from 'vitest';
import { post, get, getTestToken } from '../../helpers/api';
import { createCompanyPayload, createAgentPayload, createHeartbeatPayload } from '../../helpers/fixtures';
import { resetDatabase } from '../../helpers/db';

describe('Usage Records', () => {
  let token: string;
  let companyId: string;
  let agentId: string;

  beforeEach(async () => {
    await resetDatabase();
    token = await getTestToken();
    const co = await post('/companies', createCompanyPayload(), { token });
    companyId = co.body.data!.id;
    const ag = await post(`/companies/${companyId}/agents`, createAgentPayload(), { token });
    agentId = ag.body.data!.id;
  });

  const hbUrl = () => `/companies/${companyId}/agents/${agentId}/heartbeat`;

  describe('Usage recording via heartbeat', () => {
    it('heartbeat should create usage and reflect in company usage', async () => {
      await post(hbUrl(), createHeartbeatPayload({
        agent_id: agentId, status: 'idle',
        token_usage: { prompt_tokens: 1000, completion_tokens: 500, cost_usd: 0.05 },
      }), { token });

      const res = await get(`/companies/${companyId}/usage`, { token });
      expect(res.status).toBe(200);
      expect(res.body.data!.company_id).toBe(companyId);
    });

    it('GET /users/me/usage should return usage summary', async () => {
      await post(hbUrl(), createHeartbeatPayload({
        agent_id: agentId, status: 'idle',
        token_usage: { prompt_tokens: 100, completion_tokens: 50, cost_usd: 0.01 },
      }), { token });

      const res = await get('/users/me/usage', { token });
      expect(res.status).toBe(200);
      expect(res.body.data!.this_month).toBeDefined();
    });
  });

  describe('Company usage by agent', () => {
    it('GET /companies/:id/usage/agents should return array', async () => {
      await post(hbUrl(), createHeartbeatPayload({
        agent_id: agentId, status: 'idle',
        token_usage: { prompt_tokens: 500, completion_tokens: 200, cost_usd: 0.02 },
      }), { token });

      const res = await get(`/companies/${companyId}/usage/agents`, { token });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /companies/:id/usage/models should return array', async () => {
      await post(hbUrl(), createHeartbeatPayload({
        agent_id: agentId, status: 'idle',
        token_usage: { prompt_tokens: 500, completion_tokens: 200, cost_usd: 0.02 },
      }), { token });

      const res = await get(`/companies/${companyId}/usage/models`, { token });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Usage isolation', () => {
    it('different users usage should be isolated', async () => {
      await post(hbUrl(), createHeartbeatPayload({
        agent_id: agentId, status: 'idle',
        token_usage: { prompt_tokens: 1000, completion_tokens: 500, cost_usd: 0.1 },
      }), { token });

      const tokenB = await getTestToken();
      const res = await get('/users/me/usage', { token: tokenB });
      expect(res.status).toBe(200);
      expect(res.body.data!.total_tokens).toBe(0);
    });
  });
});

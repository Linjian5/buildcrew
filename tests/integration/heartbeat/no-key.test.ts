import { describe, it, expect, beforeEach } from 'vitest';
import { post, del, getTestToken } from '../../helpers/api';
import { createCompanyPayload, createAgentPayload, createHeartbeatPayload } from '../../helpers/fixtures';
import { resetDatabase } from '../../helpers/db';

describe('Heartbeat — No API Key Scenario', () => {
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

  describe('Agent model without API key', () => {
    it('heartbeat should still process when no model key exists', async () => {
      const res = await post(hbUrl(), createHeartbeatPayload({
        agent_id: agentId, status: 'idle',
        token_usage: { prompt_tokens: 100, completion_tokens: 50, cost_usd: 0.01 },
      }), { token });

      expect(res.status).toBe(200);
      expect(res.body.data!.action).toBeDefined();
    });

    it('heartbeat after key deletion should still process', async () => {
      const keyRes = await post('/users/me/model-keys', {
        provider: 'anthropic', display_name: 'Temp Key',
        api_key: 'sk-ant-temp-key-abcdefghij1234567890',
      }, { token });

      if (keyRes.status === 201) {
        const keyId = keyRes.body.data!.id;

        const hb1 = await post(hbUrl(), createHeartbeatPayload({
          agent_id: agentId, status: 'idle',
          token_usage: { prompt_tokens: 100, completion_tokens: 50, cost_usd: 0.01 },
        }), { token });
        expect(hb1.status).toBe(200);

        await del(`/users/me/model-keys/${keyId}`, { token });

        const hb2 = await post(hbUrl(), createHeartbeatPayload({
          agent_id: agentId, status: 'idle',
          token_usage: { prompt_tokens: 100, completion_tokens: 50, cost_usd: 0.01 },
        }), { token });
        expect(hb2.status).toBe(200);
        expect(hb2.body.data!.action).toBeDefined();
      }
    });
  });
});

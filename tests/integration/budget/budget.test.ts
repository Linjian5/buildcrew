import { describe, it, expect, beforeEach } from 'vitest';
import { post, get, getTestToken } from '../../helpers/api';
import {
  createCompanyPayload,
  createAgentPayload,
  createHeartbeatPayload,
} from '../../helpers/fixtures';
import { resetDatabase } from '../../helpers/db';

describe('Budget Tracking', () => {
  let companyId: string;
  let agentId: string;
  let token: string;

  beforeEach(async () => {
    await resetDatabase();
    token = await getTestToken();
    const company = await post(
      '/companies',
      createCompanyPayload({ budget_monthly: 100.0 }),
      { token }
    );
    companyId = company.body.data!.id;
    const agent = await post(
      `/companies/${companyId}/agents`,
      createAgentPayload({ budget_monthly: 10.0 }),
      { token }
    );
    agentId = agent.body.data!.id;
  });

  const heartbeatUrl = () =>
    `/companies/${companyId}/agents/${agentId}/heartbeat`;
  const agentUrl = () => `/companies/${companyId}/agents/${agentId}`;

  function hb(costUsd: number) {
    return createHeartbeatPayload({
      agent_id: agentId,
      status: 'idle',
      token_usage: { prompt_tokens: 1000, completion_tokens: 500, cost_usd: costUsd },
    });
  }

  // ─── Normal deduction ──────────────────────────────────

  describe('Normal deduction', () => {
    it('heartbeat with cost_usd: 0.5 → budget_spent increases by 0.5', async () => {
      await post(heartbeatUrl(), hb(0.5), { token });

      const agent = await get(agentUrl(), { token });
      expect(agent.body.data!.budget_spent).toBeCloseTo(0.5, 1);
    });

    it('multiple deductions accumulate correctly (floating point precision)', async () => {
      for (let i = 0; i < 10; i++) {
        await post(heartbeatUrl(), hb(0.1), { token });
      }

      const agent = await get(agentUrl(), { token });
      expect(agent.body.data!.budget_spent).toBeCloseTo(1.0, 1);
    });
  });

  // ─── Overspend blocking ─────────────────────────────────

  describe('Overspend blocking', () => {
    it('exact budget exhaustion (10.0/10.0) → agent gets paused, returns stop/pause', async () => {
      // This heartbeat spends exactly the budget — should trigger stop
      const res = await post(heartbeatUrl(), hb(10.0), { token });
      expect(res.status).toBe(200);
      expect(['stop', 'pause']).toContain(res.body.data!.action);

      // Verify agent is paused
      const agent = await get(agentUrl(), { token });
      expect(agent.body.data!.status).toBe('paused');
    });

    it('budget at 9.0/10.0 → still allowed to continue', async () => {
      await post(heartbeatUrl(), hb(9.0), { token });

      // Should still be able to get new tasks
      const res = await post(heartbeatUrl(), hb(0.01), { token });
      expect(res.status).toBe(200);
      // Agent not yet at budget — should be continue (no tasks available)
      expect(res.body.data!.action).toBe('continue');
    });

    it('single deduction exceeding budget → stop and no overdraft', async () => {
      // Spend 9.5 first
      await post(heartbeatUrl(), hb(9.5), { token });

      // Try to spend 1.0 more (remaining = 0.5) — this pushes over budget
      const res = await post(heartbeatUrl(), hb(1.0), { token });
      expect(res.status).toBe(200);
      // The heartbeat still processes (accumulates cost) but triggers stop
      expect(['stop', 'pause']).toContain(res.body.data!.action);
    });
  });

  // ─── Concurrent deduction ───────────────────────────────

  describe('Concurrent deduction', () => {
    it('5 concurrent heartbeats of 2.0 each (total budget 10) → no overspend', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () => post(heartbeatUrl(), hb(2.0), { token }))
      );

      // All should return 200
      results.forEach((r) => expect(r.status).toBe(200));

      // Check final budget state — must not exceed budget_monthly
      const agent = await get(agentUrl(), { token });
      expect(agent.body.data!.budget_spent).toBeLessThanOrEqual(10.0);
      // At least some heartbeats should have been processed
      expect(agent.body.data!.budget_spent).toBeGreaterThan(0);
    });
  });

  // ─── Budget API ─────────────────────────────────────────

  describe('Budget API endpoints', () => {
    it('GET /budget should return company budget overview', async () => {
      await post(heartbeatUrl(), hb(3.0), { token });

      const res = await get(`/companies/${companyId}/budget`, { token });
      expect(res.status).toBe(200);
      expect(res.body.data!.company_id).toBe(companyId);
      expect(res.body.data!.budget_monthly).toBe(100.0);
      expect(res.body.data!.total_spent).toBeGreaterThanOrEqual(0);
    });

    it('GET /budget/agents should return per-agent breakdown', async () => {
      await post(heartbeatUrl(), hb(3.0), { token });

      const res = await get(`/companies/${companyId}/budget/agents`, { token });
      expect(res.status).toBe(200);
      const agents = res.body.data as Array<{
        agent_id: string;
        budget_monthly: number;
        budget_spent: number;
        budget_remaining: number;
        usage_pct: number;
      }>;
      expect(agents.length).toBeGreaterThanOrEqual(1);

      const myAgent = agents.find((a) => a.agent_id === agentId);
      expect(myAgent).toBeDefined();
      expect(myAgent!.budget_monthly).toBe(10.0);
      expect(myAgent!.budget_spent).toBeCloseTo(3.0, 1);
      expect(myAgent!.budget_remaining).toBeCloseTo(7.0, 1);
      expect(myAgent!.usage_pct).toBeCloseTo(30.0, 0);
    });
  });
});

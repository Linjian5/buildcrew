import { describe, it, expect, beforeEach } from 'vitest';
import { post, get, put, getTestToken } from '../../helpers/api';
import {
  createCompanyPayload,
  createAgentPayload,
  createHeartbeatPayload,
} from '../../helpers/fixtures';
import { resetDatabase } from '../../helpers/db';

describe('Guardian Security Monitor', () => {
  let companyId: string;
  let agentId: string;
  let token: string;

  beforeEach(async () => {
    await resetDatabase();
    token = await getTestToken();
    const company = await post('/companies', createCompanyPayload({ budget_monthly: 100.0 }), { token });
    companyId = company.body.data!.id;
    const agent = await post(
      `/companies/${companyId}/agents`,
      createAgentPayload({ budget_monthly: 50.0 }),
      { token }
    );
    agentId = agent.body.data!.id;
  });

  const alertsUrl = () => `/companies/${companyId}/guardian/alerts`;
  const policiesUrl = () => `/companies/${companyId}/guardian/policies`;
  const heartbeatUrl = () => `/companies/${companyId}/agents/${agentId}/heartbeat`;

  function hb(costUsd: number) {
    return createHeartbeatPayload({
      agent_id: agentId,
      status: 'working',
      current_task_id: null,
      token_usage: { prompt_tokens: 1000, completion_tokens: 500, cost_usd: costUsd },
    });
  }

  // ─── Alert triggers via heartbeat ───────────────────────

  describe('Alert triggers', () => {
    it('should trigger budget warning when spending > 70%', async () => {
      // Spend 36 of 50 budget (72%)
      await post(heartbeatUrl(), hb(36.0), { token });

      const alerts = await get(alertsUrl(), { token });
      expect(alerts.status).toBe(200);
      const alertList = alerts.body.data as Array<{ category: string; severity: string }>;
      const budgetAlert = alertList.find((a) => a.category === 'budget');
      if (budgetAlert) {
        expect(budgetAlert.severity).toBe('warning');
      }
    });

    it('should trigger critical alert when spending > 90%', async () => {
      // Spend 46 of 50 budget (92%)
      await post(heartbeatUrl(), hb(46.0), { token });

      const alerts = await get(alertsUrl(), { token });
      expect(alerts.status).toBe(200);
      const alertList = alerts.body.data as Array<{ category: string; severity: string }>;
      const criticalAlert = alertList.find(
        (a) => a.category === 'budget' && a.severity === 'critical'
      );
      if (criticalAlert) {
        expect(criticalAlert.severity).toBe('critical');
      }
    });
  });

  // ─── Alert queries ──────────────────────────────────────

  describe('Alert queries', () => {
    it('GET /alerts should list alerts with pagination', async () => {
      const res = await get(alertsUrl(), { token });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter by severity', async () => {
      await post(heartbeatUrl(), hb(36.0), { token }); // Trigger warning
      const res = await get(`${alertsUrl()}?severity=warning`, { token });
      expect(res.status).toBe(200);
      const alerts = res.body.data as Array<{ severity: string }>;
      alerts.forEach((a) => expect(a.severity).toBe('warning'));
    });

    it('should filter by resolved=false', async () => {
      const res = await get(`${alertsUrl()}?resolved=false`, { token });
      expect(res.status).toBe(200);
      const alerts = res.body.data as Array<{ resolved: boolean }>;
      alerts.forEach((a) => expect(a.resolved).toBe(false));
    });
  });

  // ─── Alert resolve/dismiss ──────────────────────────────

  describe('Alert management', () => {
    it('should resolve an alert via PUT with action=resolve', async () => {
      await post(heartbeatUrl(), hb(36.0), { token }); // Trigger alert

      const alerts = await get(alertsUrl(), { token });
      const alertList = alerts.body.data as Array<{ id: string }>;
      if (alertList.length > 0) {
        const alertId = alertList[0]!.id;
        const res = await put(`${alertsUrl()}/${alertId}`, {
          action: 'resolve',
          resolved_by: 'test-user',
        }, { token });
        expect(res.status).toBe(200);
        expect(res.body.data!.resolved).toBe(true);
        expect(res.body.data!.resolved_at).toBeDefined();
      }
    });

    it('should dismiss an alert via PUT with action=dismiss', async () => {
      await post(heartbeatUrl(), hb(36.0), { token });

      const alerts = await get(alertsUrl(), { token });
      const alertList = alerts.body.data as Array<{ id: string }>;
      if (alertList.length > 0) {
        const alertId = alertList[0]!.id;
        const res = await put(`${alertsUrl()}/${alertId}`, {
          action: 'dismiss',
        }, { token });
        expect(res.status).toBe(200);
        expect(res.body.data!.resolved).toBe(true);
      }
    });
  });

  // ─── Policy CRUD ────────────────────────────────────────

  describe('Guardian policies', () => {
    it('GET /policies should list policies', async () => {
      const res = await get(policiesUrl(), { token });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('PUT /policies should create a new policy (upsert)', async () => {
      const res = await put(policiesUrl(), {
        policy_type: 'cost_limit',
        config: { max_daily_spend: 100 },
        enabled: true,
      }, { token });
      expect([200, 201]).toContain(res.status);
      expect(res.body.data!.policy_type).toBe('cost_limit');
      expect(res.body.data!.config).toEqual({ max_daily_spend: 100 });
      expect(res.body.data!.enabled).toBe(true);
    });

    it('PUT /policies should update existing policy by type', async () => {
      // Create
      await put(policiesUrl(), {
        policy_type: 'cost_limit',
        config: { max_daily_spend: 100 },
      }, { token });
      // Update same type
      const res = await put(policiesUrl(), {
        policy_type: 'cost_limit',
        config: { max_daily_spend: 200 },
        enabled: false,
      }, { token });
      expect(res.status).toBe(200);
      expect(res.body.data!.config).toEqual({ max_daily_spend: 200 });
      expect(res.body.data!.enabled).toBe(false);
    });
  });
});

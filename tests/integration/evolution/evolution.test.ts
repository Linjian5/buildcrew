import { describe, it, expect, beforeEach } from 'vitest';
import { post, get, getTestToken } from '../../helpers/api';
import { createCompanyPayload, createAgentPayload, createTaskPayload } from '../../helpers/fixtures';
import { resetDatabase } from '../../helpers/db';

describe('Evolution Engine', () => {
  let companyId: string;
  let agentId: string;
  let token: string;

  beforeEach(async () => {
    await resetDatabase();
    token = await getTestToken();
    const co = await post('/companies', createCompanyPayload(), { token });
    companyId = co.body.data!.id;
    const ag = await post(`/companies/${companyId}/agents`, createAgentPayload(), { token });
    agentId = ag.body.data!.id;
  });

  const perfUrl = () => `/companies/${companyId}/agents/${agentId}/performance`;
  const expUrl = () => `/companies/${companyId}/experiments`;

  async function completeTask(title?: string) {
    const t = await post(`/companies/${companyId}/tasks`, createTaskPayload({ title: title ?? `Task ${Date.now()}` }), { token });
    const id = t.body.data!.id;
    await post(`/companies/${companyId}/tasks/${id}/assign`, { agent_id: agentId }, { token });
    await post(`/companies/${companyId}/tasks/${id}/complete`, {}, { token });
    return id;
  }

  // ─── Performance ────────────────────────────────────────

  describe('GET /agents/:id/performance', () => {
    it('should return performance data with radar fields', async () => {
      await completeTask();
      const res = await get(perfUrl(), { token });
      expect(res.status).toBe(200);
      expect(res.body.data!.agent_id).toBe(agentId);
      expect(res.body.data!.radar).toBeDefined();
      expect(res.body.data!.radar.correctness).toBeDefined();
      expect(res.body.data!.radar.code_quality).toBeDefined();
      expect(res.body.data!.radar.efficiency).toBeDefined();
      expect(res.body.data!.radar.cost_efficiency).toBeDefined();
    });

    it('should return total_tasks count', async () => {
      await completeTask('T1');
      await completeTask('T2');
      await completeTask('T3');
      const res = await get(perfUrl(), { token });
      expect(res.status).toBe(200);
      expect(res.body.data!.total_tasks).toBeGreaterThanOrEqual(2);
    });

    it('should include trend field', async () => {
      await completeTask();
      const res = await get(perfUrl(), { token });
      expect(res.status).toBe(200);
      expect(['improving', 'stable', 'declining']).toContain(res.body.data!.trend);
    });

    it('should include recent_scores array', async () => {
      await completeTask();
      const res = await get(perfUrl(), { token });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data!.recent_scores)).toBe(true);
    });
  });

  // ─── Task scoring ───────────────────────────────────────

  describe('Task auto-scoring', () => {
    it('completed task should have score populated', async () => {
      const taskId = await completeTask();
      const task = await get(`/companies/${companyId}/tasks/${taskId}`, { token });
      expect(task.status).toBe(200);
      if (task.body.data!.score) {
        const s = task.body.data!.score;
        expect(s.overall).toBeGreaterThanOrEqual(0);
        expect(s.overall).toBeLessThanOrEqual(100);
        expect(s.correctness).toBeDefined();
        expect(s.code_quality).toBeDefined();
      }
    });
  });

  // ─── A/B Experiments ────────────────────────────────────

  describe('Experiments', () => {
    it('should create experiment and return 201', async () => {
      const res = await post(expUrl(), {
        name: 'Model Comparison',
        description: 'Claude vs GPT-4',
        variant_a: { model: 'claude-opus-4' },
        variant_b: { model: 'gpt-4o' },
      }, { token });
      expect(res.status).toBe(201);
      expect(res.body.data!.name).toBe('Model Comparison');
      expect(res.body.data!.status).toBeDefined();
    });

    it('should list experiments with pagination', async () => {
      await post(expUrl(), { name: 'Exp1', variant_a: {}, variant_b: {} }, { token });
      const res = await get(expUrl(), { token });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return experiment results with variant stats', async () => {
      const exp = await post(expUrl(), { name: 'Results', variant_a: {}, variant_b: {} }, { token });
      const expId = exp.body.data!.id;

      const res = await get(`${expUrl()}/${expId}/results`, { token });
      expect(res.status).toBe(200);
      expect(res.body.data!.experiment_id).toBe(expId);
      expect(res.body.data!.variant_a).toBeDefined();
      expect(res.body.data!.variant_b).toBeDefined();
    });
  });
});

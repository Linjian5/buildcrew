import { describe, it, expect, beforeEach } from 'vitest';
import { post, get, put, getTestToken } from '../../helpers/api';
import {
  createCompanyPayload,
  createAgentPayload,
  createTaskPayload,
} from '../../helpers/fixtures';
import { resetDatabase } from '../../helpers/db';

describe('Smart Router', () => {
  let companyId: string;
  let token: string;

  beforeEach(async () => {
    await resetDatabase();
    token = await getTestToken();
    const company = await post('/companies', createCompanyPayload(), { token });
    companyId = company.body.data!.id;
  });

  const tasksUrl = () => `/companies/${companyId}/tasks`;
  const taskUrl = (id: string) => `/companies/${companyId}/tasks/${id}`;
  const agentsUrl = () => `/companies/${companyId}/agents`;

  // ─── PUT /routing/strategy ──────────────────────────────

  describe('PUT /companies/:companyId/routing/strategy', () => {
    it('should set routing strategy', async () => {
      const res = await put(`/companies/${companyId}/routing/strategy`, {
        strategy: 'quality_first',
      }, { token });
      expect(res.status).toBe(200);
      expect(res.body.data!.strategy).toBe('quality_first');
    });

    it('should accept all 5 valid strategies', async () => {
      for (const strategy of ['cost_optimized', 'quality_first', 'speed_first', 'balanced', 'round_robin']) {
        const res = await put(`/companies/${companyId}/routing/strategy`, { strategy }, { token });
        expect(res.status).toBe(200);
        expect(res.body.data!.strategy).toBe(strategy);
      }
    });

    it('should reject invalid strategy', async () => {
      const res = await put(`/companies/${companyId}/routing/strategy`, {
        strategy: 'invalid_strategy',
      }, { token });
      expect(res.status).toBe(400);
    });
  });

  // ─── POST /tasks/:taskId/route ──────────────────────────

  describe('POST /companies/:companyId/tasks/:taskId/route', () => {
    it('should route task to an available agent', async () => {
      await post(agentsUrl(), createAgentPayload({ name: 'Router Agent' }), { token });
      const task = await post(tasksUrl(), createTaskPayload(), { token });
      const taskId = task.body.data!.id;

      const res = await post(`${taskUrl(taskId)}/route`, {}, { token });
      expect(res.status).toBe(200);
      expect(res.body.data!.task_id).toBe(taskId);
      expect(res.body.data!.selected_agent_id).toBeDefined();
      expect(res.body.data!.strategy).toBeDefined();
      expect(res.body.data!.reasoning).toBeDefined();
    });

    it('should return 422 when no agents available', async () => {
      const task = await post(tasksUrl(), createTaskPayload(), { token });
      const taskId = task.body.data!.id;

      const res = await post(`${taskUrl(taskId)}/route`, {}, { token });
      expect(res.status).toBe(422);
      expect(res.body.error).toBeDefined();
    });

    it('should skip paused agents', async () => {
      const agent1 = await post(agentsUrl(), createAgentPayload({ name: 'Paused' }), { token });
      await post(`${agentsUrl()}/${agent1.body.data!.id}/pause`, {}, { token });
      const agent2 = await post(agentsUrl(), createAgentPayload({ name: 'Active' }), { token });

      const task = await post(tasksUrl(), createTaskPayload(), { token });
      const res = await post(`${taskUrl(task.body.data!.id)}/route`, {}, { token });

      expect(res.status).toBe(200);
      expect(res.body.data!.selected_agent_id).toBe(agent2.body.data!.id);
    });
  });

  // ─── GET /routing/decisions ─────────────────────────────

  describe('GET /companies/:companyId/routing/decisions', () => {
    it('should record and list routing decisions', async () => {
      await post(agentsUrl(), createAgentPayload(), { token });
      const task = await post(tasksUrl(), createTaskPayload(), { token });
      await post(`${taskUrl(task.body.data!.id)}/route`, {}, { token });

      const res = await get(`/companies/${companyId}/routing/decisions`, { token });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect((res.body.data as unknown[]).length).toBeGreaterThanOrEqual(1);
    });

    it('should support pagination', async () => {
      const res = await get(`/companies/${companyId}/routing/decisions?page=1&limit=5`, { token });
      expect(res.status).toBe(200);
    });
  });
});

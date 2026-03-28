import { describe, it, expect, beforeEach } from 'vitest';
import { post, get, getTestToken } from '../../helpers/api';
import {
  createCompanyPayload,
  createAgentPayload,
  createTaskPayload,
  createHeartbeatPayload,
} from '../../helpers/fixtures';
import { resetDatabase } from '../../helpers/db';

describe('Heartbeat Engine', () => {
  let companyId: string;
  let agentId: string;
  let token: string;

  beforeEach(async () => {
    await resetDatabase();
    token = await getTestToken();
    const company = await post('/companies', createCompanyPayload(), { token });
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
  const tasksUrl = () => `/companies/${companyId}/tasks`;

  // ─── Normal flow ────────────────────────────────────────

  describe('Normal heartbeat flow', () => {
    it('idle agent + pending backlog task → action: new_task with task data', async () => {
      await post(tasksUrl(), createTaskPayload({ title: 'Pending Task', priority: 'high' }), { token });

      const res = await post(
        heartbeatUrl(),
        createHeartbeatPayload({
          agent_id: agentId,
          status: 'idle',
          token_usage: { prompt_tokens: 0, completion_tokens: 0, cost_usd: 0 },
        }),
        { token }
      );

      expect(res.status).toBe(200);
      expect(res.body.data!.action).toBe('new_task');
      expect(res.body.data!.task).toBeDefined();
      expect(res.body.data!.task).not.toBeNull();
      expect(res.body.data!.task.title).toBe('Pending Task');
    });

    it('idle agent + no tasks → action: continue', async () => {
      const res = await post(
        heartbeatUrl(),
        createHeartbeatPayload({
          agent_id: agentId,
          status: 'idle',
          token_usage: { prompt_tokens: 0, completion_tokens: 0, cost_usd: 0 },
        }),
        { token }
      );

      expect(res.status).toBe(200);
      expect(res.body.data!.action).toBe('continue');
      expect(res.body.data!.task).toBeNull();
    });

    it('working agent heartbeat → action: continue', async () => {
      // Create and assign a task first
      const task = await post(tasksUrl(), createTaskPayload(), { token });
      const taskId = task.body.data!.id;
      await post(`/companies/${companyId}/tasks/${taskId}/assign`, { agent_id: agentId }, { token });

      const res = await post(
        heartbeatUrl(),
        createHeartbeatPayload({
          agent_id: agentId,
          status: 'working',
          current_task_id: taskId,
          token_usage: { prompt_tokens: 100, completion_tokens: 50, cost_usd: 0.01 },
        }),
        { token }
      );

      expect(res.status).toBe(200);
      expect(res.body.data!.action).toBe('continue');
    });

    it('heartbeat should update last_heartbeat_at', async () => {
      const before = await get(agentUrl(), { token });
      const beforeHb = before.body.data!.last_heartbeat_at;

      await post(
        heartbeatUrl(),
        createHeartbeatPayload({
          agent_id: agentId,
          status: 'idle',
          token_usage: { prompt_tokens: 0, completion_tokens: 0, cost_usd: 0 },
        }),
        { token }
      );

      const after = await get(agentUrl(), { token });
      const afterHb = after.body.data!.last_heartbeat_at;

      expect(afterHb).not.toBeNull();
      if (beforeHb) {
        expect(new Date(afterHb).getTime()).toBeGreaterThanOrEqual(
          new Date(beforeHb).getTime()
        );
      }
    });
  });

  // ─── Token consumption ──────────────────────────────────

  describe('Token consumption via heartbeat', () => {
    it('heartbeat with token_usage should increase budget_spent', async () => {
      await post(
        heartbeatUrl(),
        createHeartbeatPayload({
          agent_id: agentId,
          status: 'idle',
          token_usage: { prompt_tokens: 1000, completion_tokens: 500, cost_usd: 0.5 },
        }),
        { token }
      );

      const afterAgent = await get(agentUrl(), { token });
      expect(afterAgent.body.data!.budget_spent).toBeCloseTo(0.5, 1);
    });

    it('multiple heartbeats should accumulate budget_spent', async () => {
      for (let i = 0; i < 3; i++) {
        await post(
          heartbeatUrl(),
          createHeartbeatPayload({
            agent_id: agentId,
            status: 'idle',
            token_usage: { prompt_tokens: 1000, completion_tokens: 500, cost_usd: 0.5 },
          }),
          { token }
        );
      }

      const agent = await get(agentUrl(), { token });
      expect(agent.body.data!.budget_spent).toBeCloseTo(1.5, 1);
    });
  });

  // ─── Budget control ─────────────────────────────────────

  describe('Budget control via heartbeat', () => {
    it('budget exhausted → action: stop', async () => {
      // Exhaust the budget (budget_monthly = 10)
      await post(
        heartbeatUrl(),
        createHeartbeatPayload({
          agent_id: agentId,
          status: 'idle',
          token_usage: { prompt_tokens: 10000, completion_tokens: 5000, cost_usd: 10.0 },
        }),
        { token }
      );

      // Agent should be stopped/paused — next heartbeat confirms
      const res = await post(
        heartbeatUrl(),
        createHeartbeatPayload({
          agent_id: agentId,
          status: 'idle',
          token_usage: { prompt_tokens: 0, completion_tokens: 0, cost_usd: 0 },
        }),
        { token }
      );

      expect(res.status).toBe(200);
      // When budget exhausted, agent gets paused; heartbeat returns 'pause' for paused agents
      expect(['stop', 'pause']).toContain(res.body.data!.action);
    });

    it('budget exhausted → no new task assigned even with pending tasks', async () => {
      await post(tasksUrl(), createTaskPayload(), { token });

      // Exhaust budget
      await post(
        heartbeatUrl(),
        createHeartbeatPayload({
          agent_id: agentId,
          status: 'idle',
          token_usage: { prompt_tokens: 10000, completion_tokens: 5000, cost_usd: 10.0 },
        }),
        { token }
      );

      const res = await post(
        heartbeatUrl(),
        createHeartbeatPayload({
          agent_id: agentId,
          status: 'idle',
          token_usage: { prompt_tokens: 0, completion_tokens: 0, cost_usd: 0 },
        }),
        { token }
      );

      expect(res.body.data!.task).toBeNull();
    });
  });

  // ─── Pause control ──────────────────────────────────────

  describe('Pause control', () => {
    it('paused agent heartbeat → action: pause', async () => {
      await post(`${agentUrl()}/pause`, {}, { token });

      const res = await post(
        heartbeatUrl(),
        createHeartbeatPayload({
          agent_id: agentId,
          status: 'idle',
          token_usage: { prompt_tokens: 0, completion_tokens: 0, cost_usd: 0 },
        }),
        { token }
      );

      expect(res.status).toBe(200);
      expect(res.body.data!.action).toBe('pause');
    });
  });

  // ─── Concurrency safety ─────────────────────────────────

  describe('Concurrent task assignment', () => {
    it('2 idle agents heartbeat simultaneously — only 1 gets the single task', async () => {
      const agent2 = await post(
        `/companies/${companyId}/agents`,
        createAgentPayload({ name: 'Agent 2', budget_monthly: 10.0 }),
        { token }
      );
      const agent2Id = agent2.body.data!.id;

      // Create exactly 1 task
      await post(tasksUrl(), createTaskPayload({ title: 'Contested Task', priority: 'critical' }), { token });

      const [res1, res2] = await Promise.all([
        post(
          heartbeatUrl(),
          createHeartbeatPayload({
            agent_id: agentId,
            status: 'idle',
            token_usage: { prompt_tokens: 0, completion_tokens: 0, cost_usd: 0 },
          }),
          { token }
        ),
        post(
          `/companies/${companyId}/agents/${agent2Id}/heartbeat`,
          createHeartbeatPayload({
            agent_id: agent2Id,
            status: 'idle',
            token_usage: { prompt_tokens: 0, completion_tokens: 0, cost_usd: 0 },
          }),
          { token }
        ),
      ]);

      const actions = [res1.body.data!.action, res2.body.data!.action];
      // Exactly one should get new_task, the other should get continue
      expect(actions.filter((a) => a === 'new_task').length).toBe(1);
      expect(actions.filter((a) => a === 'continue').length).toBe(1);
    });
  });
});

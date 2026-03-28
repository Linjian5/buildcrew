import { describe, it, expect, beforeEach } from 'vitest';
import { post, get, getTestToken } from '../../helpers/api';
import {
  createCompanyPayload,
  createAgentPayload,
  createTaskPayload,
} from '../../helpers/fixtures';
import { resetDatabase } from '../../helpers/db';

describe('Task State Machine', () => {
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
      createAgentPayload(),
      { token }
    );
    agentId = agent.body.data!.id;
  });

  const tasksUrl = () => `/companies/${companyId}/tasks`;
  const taskUrl = (id: string) => `/companies/${companyId}/tasks/${id}`;

  /** Create a task and optionally move it to a target status. */
  async function createTaskInStatus(targetStatus: string): Promise<string> {
    const created = await post(tasksUrl(), createTaskPayload(), { token });
    const taskId = created.body.data!.id;

    if (targetStatus === 'backlog') return taskId;

    // backlog → in_progress (via assign)
    await post(`${taskUrl(taskId)}/assign`, { agent_id: agentId }, { token });
    if (targetStatus === 'in_progress') return taskId;

    // in_progress → done (via complete)
    // Note: API goes in_progress → done directly (or in_review → done)
    if (targetStatus === 'done') {
      await post(`${taskUrl(taskId)}/complete`, {}, { token });
      return taskId;
    }

    return taskId;
  }

  // ─── Valid transitions ──────────────────────────────────

  describe('Valid transitions', () => {
    it('backlog → in_progress (via assign)', async () => {
      const taskId = await createTaskInStatus('backlog');

      const res = await post(`${taskUrl(taskId)}/assign`, {
        agent_id: agentId,
      }, { token });
      expect(res.status).toBe(200);

      const detail = await get(taskUrl(taskId), { token });
      expect(detail.body.data!.status).toBe('in_progress');
      expect(detail.body.data!.started_at).not.toBeNull();
    });

    it('backlog → in_progress (via checkout)', async () => {
      const taskId = await createTaskInStatus('backlog');

      const res = await post(`${taskUrl(taskId)}/checkout`, {
        agent_id: agentId,
      }, { token });
      expect(res.status).toBe(200);

      const detail = await get(taskUrl(taskId), { token });
      expect(detail.body.data!.status).toBe('in_progress');
      expect(detail.body.data!.assigned_agent_id).toBe(agentId);
    });

    it('in_progress → done (via complete)', async () => {
      const taskId = await createTaskInStatus('in_progress');

      const res = await post(`${taskUrl(taskId)}/complete`, {}, { token });
      expect(res.status).toBe(200);

      const detail = await get(taskUrl(taskId), { token });
      expect(detail.body.data!.status).toBe('done');
      expect(detail.body.data!.completed_at).not.toBeNull();
    });
  });

  // ─── Invalid transitions ────────────────────────────────

  describe('Invalid transitions', () => {
    it('backlog → done (via complete) should return 400', async () => {
      const taskId = await createTaskInStatus('backlog');

      const res = await post(`${taskUrl(taskId)}/complete`, {}, { token });
      expect(res.status).toBe(400);
    });

    it('done → in_progress (via assign) should return 400', async () => {
      const taskId = await createTaskInStatus('done');

      // Create a fresh agent for assignment
      const agent2 = await post(
        `/companies/${companyId}/agents`,
        createAgentPayload({ name: 'Agent 2' }),
        { token }
      );
      const agent2Id = agent2.body.data!.id;

      const res = await post(`${taskUrl(taskId)}/assign`, {
        agent_id: agent2Id,
      }, { token });
      expect(res.status).toBe(400);
    });
  });

  // ─── Atomic checkout ────────────────────────────────────

  describe('Atomic checkout', () => {
    it('should checkout task and set status to in_progress + assigned_agent_id', async () => {
      const taskId = await createTaskInStatus('backlog');

      const res = await post(`${taskUrl(taskId)}/checkout`, {
        agent_id: agentId,
      }, { token });
      expect(res.status).toBe(200);

      const detail = await get(taskUrl(taskId), { token });
      expect(detail.body.data!.status).toBe('in_progress');
      expect(detail.body.data!.assigned_agent_id).toBe(agentId);
    });

    it('should return 409 when task is already checked out', async () => {
      const taskId = await createTaskInStatus('backlog');

      // First checkout succeeds
      await post(`${taskUrl(taskId)}/checkout`, { agent_id: agentId }, { token });

      // Create second agent
      const agent2 = await post(
        `/companies/${companyId}/agents`,
        createAgentPayload({ name: 'Agent 2' }),
        { token }
      );
      const agent2Id = agent2.body.data!.id;

      // Second checkout should fail with 409
      const res = await post(`${taskUrl(taskId)}/checkout`, {
        agent_id: agent2Id,
      }, { token });
      expect(res.status).toBe(409);
    });

    it('concurrent checkout — only one should succeed (Promise.all)', async () => {
      const taskId = await createTaskInStatus('backlog');

      // Create second agent
      const agent2 = await post(
        `/companies/${companyId}/agents`,
        createAgentPayload({ name: 'Agent 2' }),
        { token }
      );
      const agent2Id = agent2.body.data!.id;

      // Fire both checkouts simultaneously
      const [res1, res2] = await Promise.all([
        post(`${taskUrl(taskId)}/checkout`, { agent_id: agentId }, { token }),
        post(`${taskUrl(taskId)}/checkout`, { agent_id: agent2Id }, { token }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // One should be 200, the other 409
      expect(statuses).toEqual([200, 409]);
    });
  });

  // ─── Complete ───────────────────────────────────────────

  describe('Task completion', () => {
    it('should set completed_at timestamp on completion', async () => {
      const taskId = await createTaskInStatus('in_progress');

      const res = await post(`${taskUrl(taskId)}/complete`, {}, { token });
      expect(res.status).toBe(200);

      const detail = await get(taskUrl(taskId), { token });
      expect(detail.body.data!.completed_at).toBeDefined();
      expect(detail.body.data!.completed_at).not.toBeNull();
      expect(detail.body.data!.status).toBe('done');
    });

    it('should calculate duration_ms = completed_at - started_at (±2s tolerance)', async () => {
      const taskId = await createTaskInStatus('in_progress');

      // Get started_at
      const before = await get(taskUrl(taskId), { token });
      const startedAt = new Date(before.body.data!.started_at).getTime();

      // Wait a tiny bit then complete
      await new Promise((r) => setTimeout(r, 100));
      await post(`${taskUrl(taskId)}/complete`, {}, { token });

      const after = await get(taskUrl(taskId), { token });
      const completedAt = new Date(after.body.data!.completed_at).getTime();
      const expectedDuration = completedAt - startedAt;
      const actualDuration = after.body.data!.duration_ms;

      // Allow 2 second tolerance
      expect(Math.abs(actualDuration - expectedDuration)).toBeLessThan(2000);
    });
  });
});

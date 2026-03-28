import { describe, it, expect, beforeEach } from 'vitest';
import { post, get, put, getTestToken } from '../../helpers/api';
import {
  createCompanyPayload,
  createAgentPayload,
  createTaskPayload,
} from '../../helpers/fixtures';
import { resetDatabase } from '../../helpers/db';

describe('Task CRUD API', () => {
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

  // ─── POST /companies/:companyId/tasks ───────────────────

  describe('POST /companies/:companyId/tasks', () => {
    it('should create task with status=backlog', async () => {
      const payload = createTaskPayload();
      const res = await post(tasksUrl(), payload, { token });

      expect(res.status).toBe(201);
      expect(res.body.data!.status).toBe('backlog');
      expect(res.body.data!.title).toBe(payload.title);
      expect(res.body.data!.company_id).toBe(companyId);
      expect(res.body.error).toBeNull();
    });

    it('should create task with assigned_agent_id but still start as backlog', async () => {
      // Per actual API: task always starts as backlog, even with assigned_agent_id
      const res = await post(
        tasksUrl(),
        createTaskPayload({ assigned_agent_id: agentId }),
        { token }
      );
      expect(res.status).toBe(201);
      expect(res.body.data!.status).toBe('backlog');
    });

    it('should return 400 when title is missing', async () => {
      const { title, ...noTitle } = createTaskPayload();
      const res = await post(tasksUrl(), noTitle, { token });
      expect(res.status).toBe(400);
      expect(res.body.error!.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when title is empty', async () => {
      const res = await post(tasksUrl(), createTaskPayload({ title: '' }), { token });
      expect(res.status).toBe(400);
    });

    it('should return 404 when companyId does not exist', async () => {
      const fakeCompanyId = '00000000-0000-4000-8000-000000000000';
      const res = await post(
        `/companies/${fakeCompanyId}/tasks`,
        createTaskPayload(),
        { token }
      );
      expect(res.status).toBe(404);
    });

    it('should accept all priority levels', async () => {
      for (const priority of ['low', 'medium', 'high', 'critical']) {
        const res = await post(tasksUrl(), createTaskPayload({ priority }), { token });
        expect(res.status).toBe(201);
        expect(res.body.data!.priority).toBe(priority);
      }
    });
  });

  // ─── GET /companies/:companyId/tasks ────────────────────

  describe('GET /companies/:companyId/tasks', () => {
    it('should return all tasks for the company', async () => {
      await post(tasksUrl(), createTaskPayload({ title: 'Task A' }), { token });
      await post(tasksUrl(), createTaskPayload({ title: 'Task B' }), { token });

      const res = await get(tasksUrl(), { token });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect((res.body.data as unknown[]).length).toBe(2);
    });

    it('should filter by status', async () => {
      await post(tasksUrl(), createTaskPayload({ title: 'Backlog Task' }), { token });

      const res = await get(`${tasksUrl()}?status=backlog`, { token });
      expect(res.status).toBe(200);
      const tasks = res.body.data as Array<{ status: string }>;
      tasks.forEach((t) => expect(t.status).toBe('backlog'));
    });

    it('should filter by agent_id', async () => {
      // Create and assign a task
      const taskRes = await post(tasksUrl(), createTaskPayload({ title: 'Agent Task' }), { token });
      const taskId = taskRes.body.data!.id;
      await post(`${taskUrl(taskId)}/assign`, { agent_id: agentId }, { token });
      // Create unassigned task
      await post(tasksUrl(), createTaskPayload({ title: 'Unassigned Task' }), { token });

      const res = await get(`${tasksUrl()}?agent_id=${agentId}`, { token });
      expect(res.status).toBe(200);
      const tasks = res.body.data as Array<{ assigned_agent_id: string }>;
      tasks.forEach((t) => expect(t.assigned_agent_id).toBe(agentId));
    });

    it('should return empty array when no tasks exist', async () => {
      const res = await get(tasksUrl(), { token });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  // ─── GET /companies/:companyId/tasks/:id ────────────────

  describe('GET /companies/:companyId/tasks/:id', () => {
    it('should return task details with all expected fields', async () => {
      const created = await post(tasksUrl(), createTaskPayload(), { token });
      const taskId = created.body.data!.id;

      const res = await get(taskUrl(taskId), { token });
      expect(res.status).toBe(200);
      expect(res.body.data!.id).toBe(taskId);
      expect(res.body.data!.company_id).toBe(companyId);
      expect(res.body.data!.goal_ancestry).toBeDefined();
    });

    it('should return 404 for non-existent task', async () => {
      const fakeId = '00000000-0000-4000-8000-000000000000';
      const res = await get(taskUrl(fakeId), { token });
      expect(res.status).toBe(404);
    });
  });

  // ─── PUT /companies/:companyId/tasks/:id ────────────────

  describe('PUT /companies/:companyId/tasks/:id', () => {
    it('should update task title', async () => {
      const created = await post(tasksUrl(), createTaskPayload(), { token });
      const taskId = created.body.data!.id;

      const res = await put(taskUrl(taskId), { title: 'Updated Title' }, { token });
      expect(res.status).toBe(200);
      expect(res.body.data!.title).toBe('Updated Title');
    });

    it('should update priority without affecting other fields', async () => {
      const created = await post(
        tasksUrl(),
        createTaskPayload({ title: 'My Task', priority: 'medium' }),
        { token }
      );
      const taskId = created.body.data!.id;

      const res = await put(taskUrl(taskId), { priority: 'critical' }, { token });
      expect(res.status).toBe(200);
      expect(res.body.data!.priority).toBe('critical');
      expect(res.body.data!.title).toBe('My Task');
    });
  });

  // ─── POST .../tasks/:id/assign ──────────────────────────

  describe('POST /companies/:companyId/tasks/:id/assign', () => {
    it('should assign task to agent and change status to in_progress', async () => {
      const created = await post(tasksUrl(), createTaskPayload(), { token });
      const taskId = created.body.data!.id;

      const res = await post(`${taskUrl(taskId)}/assign`, {
        agent_id: agentId,
      }, { token });
      expect(res.status).toBe(200);

      const detail = await get(taskUrl(taskId), { token });
      expect(detail.body.data!.assigned_agent_id).toBe(agentId);
      expect(detail.body.data!.status).toBe('in_progress');
      expect(detail.body.data!.started_at).toBeDefined();
    });

    it('should return error when assigning non-backlog task', async () => {
      const created = await post(tasksUrl(), createTaskPayload(), { token });
      const taskId = created.body.data!.id;

      // Assign once (backlog → in_progress)
      await post(`${taskUrl(taskId)}/assign`, { agent_id: agentId }, { token });

      // Try to assign again (in_progress — not backlog)
      const res = await post(`${taskUrl(taskId)}/assign`, { agent_id: agentId }, { token });
      expect(res.status).toBe(400);
    });
  });
});

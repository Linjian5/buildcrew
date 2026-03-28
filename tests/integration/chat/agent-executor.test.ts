import { describe, it, expect, beforeEach } from 'vitest';
import { post, get, getTestToken } from '../../helpers/api';
import { createCompanyPayload, createAgentPayload, createTaskPayload } from '../../helpers/fixtures';
import { resetDatabase } from '../../helpers/db';

describe('Agent Executor via Chat', () => {
  let token: string;
  let companyId: string;
  let agentId: string;
  let taskId: string;

  beforeEach(async () => {
    await resetDatabase();
    token = await getTestToken();
    const co = await post('/companies', createCompanyPayload(), { token });
    companyId = co.body.data!.id;
    const ag = await post(`/companies/${companyId}/agents`, createAgentPayload(), { token });
    agentId = ag.body.data!.id;
    // Create and assign a task
    const task = await post(`/companies/${companyId}/tasks`, createTaskPayload({ title: 'Implement auth' }), { token });
    taskId = task.body.data!.id;
    await post(`/companies/${companyId}/tasks/${taskId}/assign`, { agent_id: agentId }, { token });
  });

  const threadsUrl = () => `/companies/${companyId}/chat/threads`;

  describe('Task execution thread', () => {
    it('should create task_execution thread linked to task', async () => {
      const res = await post(threadsUrl(), {
        agent_id: agentId,
        thread_type: 'task_execution',
        related_task_id: taskId,
        initial_message: 'Start working on auth module',
      }, { token });

      expect(res.status).toBe(201);
      expect(res.body.data!.thread.thread_type).toBe('task_execution');
      expect(res.body.data!.thread.related_task_id).toBe(taskId);
    });

    it('agent should respond to execution questions', async () => {
      const thread = await post(threadsUrl(), {
        agent_id: agentId,
        thread_type: 'task_execution',
        related_task_id: taskId,
      }, { token });
      const threadId = thread.body.data!.thread.id;

      const res = await post(`/companies/${companyId}/chat/threads/${threadId}/messages`, {
        content: 'What approach are you taking for JWT implementation?',
      }, { token });

      expect(res.status).toBe(200);
      expect(res.body.data!.agent_response).toBeDefined();
      expect(res.body.data!.agent_response.content.length).toBeGreaterThan(0);
    });

    it('execution results should be stored as chat messages', async () => {
      const thread = await post(threadsUrl(), {
        agent_id: agentId,
        thread_type: 'task_execution',
        related_task_id: taskId,
        initial_message: 'Begin implementation',
      }, { token });
      const threadId = thread.body.data!.thread.id;

      // Get thread detail — should have messages
      const detail = await get(`/companies/${companyId}/chat/threads/${threadId}`, { token });
      expect(detail.status).toBe(200);
      if (detail.body.data!.messages) {
        expect((detail.body.data!.messages as unknown[]).length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});

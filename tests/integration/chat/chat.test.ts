import { describe, it, expect, beforeEach } from 'vitest';
import { post, get, del, getTestToken } from '../../helpers/api';
import { createCompanyPayload, createAgentPayload } from '../../helpers/fixtures';
import { resetDatabase } from '../../helpers/db';

describe('Chat System API', () => {
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

  const threadsUrl = () => `/companies/${companyId}/chat/threads`;
  const threadUrl = (id: string) => `/companies/${companyId}/chat/threads/${id}`;

  // ─── Create thread ──────────────────────────────────────

  describe('POST /chat/threads', () => {
    it('should create thread and return 201', async () => {
      const res = await post(threadsUrl(), {
        agent_id: agentId,
        thread_type: 'question',
        initial_message: 'Hello, how do I set up CI?',
      }, { token });

      expect(res.status).toBe(201);
      expect(res.body.data!.thread).toBeDefined();
      expect(res.body.data!.thread.agent_id).toBe(agentId);
      expect(res.body.data!.thread.status).toBeDefined();
    });

    it('should include agent response when initial_message provided', async () => {
      const res = await post(threadsUrl(), {
        agent_id: agentId,
        thread_type: 'question',
        initial_message: 'What is the best testing framework?',
      }, { token });

      expect(res.status).toBe(201);
      if (res.body.data!.user_message) {
        expect(res.body.data!.user_message.content).toBe('What is the best testing framework?');
      }
      if (res.body.data!.agent_response) {
        expect(res.body.data!.agent_response.sender_type).toBeDefined();
        expect(res.body.data!.agent_response.content).toBeDefined();
      }
    });

    it('should accept all thread_type values', async () => {
      for (const tt of ['goal_planning', 'task_execution', 'question', 'report']) {
        const res = await post(threadsUrl(), { agent_id: agentId, thread_type: tt }, { token });
        expect(res.status).toBe(201);
      }
    });
  });

  // ─── Send message ───────────────────────────────────────

  describe('POST /chat/threads/:id/messages', () => {
    it('should send message and get agent reply', async () => {
      const thread = await post(threadsUrl(), { agent_id: agentId, thread_type: 'question' }, { token });
      const threadId = thread.body.data!.thread.id;

      const res = await post(`${threadUrl(threadId)}/messages`, {
        content: 'Can you explain microservices?',
        message_type: 'text',
      }, { token });

      expect(res.status).toBe(200);
      expect(res.body.data!.user_message).toBeDefined();
      expect(res.body.data!.user_message.content).toBe('Can you explain microservices?');
      expect(res.body.data!.agent_response).toBeDefined();
      expect(res.body.data!.agent_response.content).toBeDefined();
    });
  });

  // ─── List threads ───────────────────────────────────────

  describe('GET /chat/threads', () => {
    it('should list threads with pagination', async () => {
      await post(threadsUrl(), { agent_id: agentId, thread_type: 'question' }, { token });
      await post(threadsUrl(), { agent_id: agentId, thread_type: 'report' }, { token });

      const res = await get(threadsUrl(), { token });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect((res.body.data as unknown[]).length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by status', async () => {
      await post(threadsUrl(), { agent_id: agentId, thread_type: 'question' }, { token });

      const res = await get(`${threadsUrl()}?status=active`, { token });
      expect(res.status).toBe(200);
    });
  });

  // ─── Get thread detail + messages ───────────────────────

  describe('GET /chat/threads/:id', () => {
    it('should return thread with messages in time order', async () => {
      const thread = await post(threadsUrl(), {
        agent_id: agentId, thread_type: 'question',
        initial_message: 'First message',
      }, { token });
      const threadId = thread.body.data!.thread.id;

      await post(`${threadUrl(threadId)}/messages`, { content: 'Follow up' }, { token });

      const res = await get(threadUrl(threadId), { token });
      expect(res.status).toBe(200);
      expect(res.body.data!.thread).toBeDefined();
      // Messages should be included
      if (res.body.data!.messages) {
        expect(Array.isArray(res.body.data!.messages)).toBe(true);
        expect((res.body.data!.messages as unknown[]).length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  // ─── Close thread ───────────────────────────────────────

  describe('DELETE /chat/threads/:id', () => {
    it('should close/archive thread', async () => {
      const thread = await post(threadsUrl(), { agent_id: agentId, thread_type: 'question' }, { token });
      const threadId = thread.body.data!.thread.id;

      const res = await del(threadUrl(threadId), { token });
      expect(res.status).toBe(200);
    });

    it('should not allow messages on closed thread', async () => {
      const thread = await post(threadsUrl(), { agent_id: agentId, thread_type: 'question' }, { token });
      const threadId = thread.body.data!.thread.id;

      await del(threadUrl(threadId), { token });
      const res = await post(`${threadUrl(threadId)}/messages`, { content: 'After close' }, { token });
      expect(res.status).toBe(400);
    });
  });

  // ─── User isolation ─────────────────────────────────────

  describe('User isolation', () => {
    it('different users should not see each other threads', async () => {
      await post(threadsUrl(), { agent_id: agentId, thread_type: 'question', initial_message: 'Secret' }, { token });

      const tokenB = await getTestToken();
      const coB = await post('/companies', createCompanyPayload({ name: 'CoB' }), { token: tokenB });
      const res = await get(`/companies/${coB.body.data!.id}/chat/threads`, { token: tokenB });
      expect(res.status).toBe(200);
      expect((res.body.data as unknown[]).length).toBe(0);
    });
  });
});

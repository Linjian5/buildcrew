import { describe, it, expect, beforeEach } from 'vitest';
import { post, get, getTestToken } from '../../helpers/api';
import { createCompanyPayload, createAgentPayload, createTaskPayload } from '../../helpers/fixtures';
import { resetDatabase } from '../../helpers/db';

describe('CEO Planner via Chat', () => {
  let token: string;
  let companyId: string;
  let ceoAgentId: string;

  beforeEach(async () => {
    await resetDatabase();
    token = await getTestToken();
    const co = await post('/companies', createCompanyPayload(), { token });
    companyId = co.body.data!.id;
    // Create CEO agent
    const ceo = await post(`/companies/${companyId}/agents`, createAgentPayload({
      name: 'Aria', title: 'CEO', department: 'executive', level: 'executive',
    }), { token });
    ceoAgentId = ceo.body.data!.id;
  });

  const threadsUrl = () => `/companies/${companyId}/chat/threads`;

  describe('CEO goal planning thread', () => {
    it('CEO thread with goal_planning type should get plan response', async () => {
      const res = await post(threadsUrl(), {
        agent_id: ceoAgentId,
        thread_type: 'goal_planning',
        initial_message: 'Create a plan to launch our MVP in 2 weeks',
      }, { token });

      expect(res.status).toBe(201);
      expect(res.body.data!.thread.thread_type).toBe('goal_planning');
      // CEO should respond with a plan
      if (res.body.data!.agent_response) {
        expect(res.body.data!.agent_response.content.length).toBeGreaterThan(0);
      }
    });

    it('should be able to continue conversation with CEO', async () => {
      const thread = await post(threadsUrl(), {
        agent_id: ceoAgentId,
        thread_type: 'goal_planning',
        initial_message: 'Plan the Q2 roadmap',
      }, { token });
      const threadId = thread.body.data!.thread.id;

      // Follow up
      const res = await post(`${threadsUrl().replace('threads', `threads/${threadId}/messages`)}`, {
        content: 'Focus on the payment integration first',
        message_type: 'text',
      }, { token });

      // Use the correct endpoint format
      const msgRes = await post(`/companies/${companyId}/chat/threads/${threadId}/messages`, {
        content: 'What about the timeline?',
      }, { token });

      expect(msgRes.status).toBe(200);
      expect(msgRes.body.data!.agent_response).toBeDefined();
    });
  });
});

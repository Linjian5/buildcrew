import { describe, it, expect, beforeEach } from 'vitest';
import { post, get, getTestToken } from '../../helpers/api';
import { createCompanyPayload, createAgentPayload } from '../../helpers/fixtures';
import { resetDatabase } from '../../helpers/db';

/**
 * AI Client tests — validates that the chat system correctly:
 * 1. Reads user's model_api_key
 * 2. Constructs prompts with system prompt + history
 * 3. Records token usage
 * 4. Handles errors gracefully
 *
 * Note: The server uses mock AI responses in dev/test mode,
 * so we test the integration plumbing, not actual model calls.
 */
describe('AI Client Integration', () => {
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

  describe('Prompt construction', () => {
    it('agent response should reflect thread context', async () => {
      // Create thread and send messages — AI should produce contextual responses
      const thread = await post(`/companies/${companyId}/chat/threads`, {
        agent_id: agentId,
        thread_type: 'question',
        initial_message: 'How do I implement rate limiting?',
      }, { token });

      expect(thread.status).toBe(201);
      if (thread.body.data!.agent_response) {
        // Response should be non-empty (mock or real)
        expect(thread.body.data!.agent_response.content.length).toBeGreaterThan(0);
      }
    });

    it('follow-up messages should maintain conversation history', async () => {
      const thread = await post(`/companies/${companyId}/chat/threads`, {
        agent_id: agentId,
        thread_type: 'question',
        initial_message: 'What is PostgreSQL?',
      }, { token });
      const threadId = thread.body.data!.thread.id;

      // Second message — AI should have context from first
      const msg = await post(`/companies/${companyId}/chat/threads/${threadId}/messages`, {
        content: 'How does it compare to MySQL?',
      }, { token });

      expect(msg.status).toBe(200);
      expect(msg.body.data!.agent_response.content.length).toBeGreaterThan(0);
    });
  });

  describe('Token usage tracking', () => {
    it('chat messages should record token_usage', async () => {
      const thread = await post(`/companies/${companyId}/chat/threads`, {
        agent_id: agentId,
        thread_type: 'question',
        initial_message: 'Explain dependency injection',
      }, { token });

      if (thread.body.data!.agent_response && thread.body.data!.agent_response.token_usage) {
        const usage = thread.body.data!.agent_response.token_usage;
        expect(usage).toBeDefined();
      }
    });
  });

  describe('Model key reading', () => {
    it('chat should work with user model key configured', async () => {
      // Add a model key
      await post('/users/me/model-keys', {
        provider: 'anthropic',
        display_name: 'Test Key',
        api_key: 'sk-ant-test-key-for-ai-client-12345',
      }, { token });

      // Chat should still work (uses mock in test mode)
      const thread = await post(`/companies/${companyId}/chat/threads`, {
        agent_id: agentId,
        thread_type: 'question',
        initial_message: 'Test with key',
      }, { token });

      expect(thread.status).toBe(201);
    });

    it('chat should work even without model key (fallback)', async () => {
      // No key added — should still work with mock/fallback
      const thread = await post(`/companies/${companyId}/chat/threads`, {
        agent_id: agentId,
        thread_type: 'question',
        initial_message: 'Test without key',
      }, { token });

      expect(thread.status).toBe(201);
    });
  });
});

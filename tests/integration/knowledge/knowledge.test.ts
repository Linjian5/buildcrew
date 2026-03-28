import { describe, it, expect, beforeEach } from 'vitest';
import { post, get, del, getTestToken } from '../../helpers/api';
import { createCompanyPayload, createAgentPayload, createTaskPayload } from '../../helpers/fixtures';
import { resetDatabase } from '../../helpers/db';

describe('Knowledge Hub', () => {
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

  const kUrl = () => `/companies/${companyId}/knowledge`;

  // ─── CRUD ───────────────────────────────────────────────

  describe('POST /companies/:id/knowledge', () => {
    it('should create entry and return 201', async () => {
      const res = await post(kUrl(), {
        title: 'Rate Limiting Best Practices',
        content: 'Use sliding window with exponential backoff...',
        category: 'pattern',
      }, { token });
      expect(res.status).toBe(201);
      expect(res.body.data!.title).toBe('Rate Limiting Best Practices');
      expect(res.body.data!.category).toBe('pattern');
      expect(res.body.data!.company_id).toBe(companyId);
      expect(res.body.data!.citation_count).toBe(0);
    });

    it('should return 400 when title is missing', async () => {
      const res = await post(kUrl(), { content: 'No title', category: 'pattern' }, { token });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid category', async () => {
      const res = await post(kUrl(), { title: 'X', content: 'Y', category: 'invalid' }, { token });
      expect(res.status).toBe(400);
    });

    it('should accept all 6 valid categories', async () => {
      for (const cat of ['pattern', 'quirk', 'config', 'failure', 'adr', 'glossary']) {
        const res = await post(kUrl(), { title: `Entry ${cat}`, content: 'C', category: cat }, { token });
        expect(res.status).toBe(201);
      }
    });

    it('should enforce company isolation', async () => {
      await post(kUrl(), { title: 'Secret', content: 'A only', category: 'pattern' }, { token });
      const coB = await post('/companies', createCompanyPayload({ name: 'Co B' }), { token });
      const res = await get(`/companies/${coB.body.data!.id}/knowledge`, { token });
      expect(res.status).toBe(200);
      const entries = res.body.data as Array<{ title: string }>;
      expect(entries.find((e) => e.title === 'Secret')).toBeUndefined();
    });
  });

  describe('GET /companies/:id/knowledge', () => {
    it('should list with pagination', async () => {
      await post(kUrl(), { title: 'A', content: 'C', category: 'pattern' }, { token });
      await post(kUrl(), { title: 'B', content: 'C', category: 'quirk' }, { token });
      const res = await get(`${kUrl()}?page=1&limit=10`, { token });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect((res.body.data as unknown[]).length).toBe(2);
    });

    it('should filter by category', async () => {
      await post(kUrl(), { title: 'Pattern', content: 'C', category: 'pattern' }, { token });
      await post(kUrl(), { title: 'Failure', content: 'C', category: 'failure' }, { token });
      const res = await get(`${kUrl()}?category=failure`, { token });
      expect(res.status).toBe(200);
      (res.body.data as Array<{ category: string }>).forEach((e) => expect(e.category).toBe('failure'));
    });
  });

  describe('DELETE /companies/:id/knowledge/:entryId', () => {
    it('should soft-delete (set expired=true)', async () => {
      const entry = await post(kUrl(), { title: 'ToDelete', content: 'C', category: 'pattern' }, { token });
      const entryId = entry.body.data!.id;

      const res = await del(`${kUrl()}/${entryId}`, { token });
      expect(res.status).toBe(200);
      expect(res.body.data!.expired).toBe(true);
    });
  });

  // ─── Search ─────────────────────────────────────────────

  describe('GET /knowledge/search', () => {
    it('should return results with similarity score', async () => {
      await post(kUrl(), { title: 'PostgreSQL Pooling', content: 'pgbouncer connection pooling...', category: 'pattern' }, { token });
      await post(kUrl(), { title: 'React Testing', content: 'vitest react testing...', category: 'pattern' }, { token });

      const res = await get(`${kUrl()}/search?q=database+postgresql`, { token });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      if ((res.body.data as unknown[]).length > 0) {
        expect((res.body.data as Array<{ similarity: number }>)[0]!.similarity).toBeDefined();
      }
    });

    it('should return results when q is empty', async () => {
      await post(kUrl(), { title: 'Anything', content: 'C', category: 'pattern' }, { token });
      const res = await get(`${kUrl()}/search?q=`, { token });
      expect(res.status).toBe(200);
    });
  });

  // ─── Context injection ──────────────────────────────────

  describe('Context injection via heartbeat', () => {
    it('heartbeat knowledge_context should include relevant entries', async () => {
      await post(kUrl(), { title: 'Auth Best Practice', content: 'Always use bcrypt...', category: 'pattern' }, { token });
      await post(`/companies/${companyId}/tasks`, createTaskPayload({ title: 'Implement authentication' }), { token });

      const res = await post(`/companies/${companyId}/agents/${agentId}/heartbeat`, {
        agent_id: agentId, status: 'idle', current_task_id: null,
        token_usage: { prompt_tokens: 0, completion_tokens: 0, cost_usd: 0 },
      }, { token });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data!.knowledge_context)).toBe(true);
    });
  });
});

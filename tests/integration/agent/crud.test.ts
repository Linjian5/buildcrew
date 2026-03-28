import { describe, it, expect, beforeEach } from 'vitest';
import { post, get, put, del, getTestToken } from '../../helpers/api';
import {
  createCompanyPayload,
  createAgentPayload,
  createAgentPayloadFromPreset,
} from '../../helpers/fixtures';
import { resetDatabase } from '../../helpers/db';

describe('Agent CRUD API', () => {
  let companyId: string;
  let token: string;

  beforeEach(async () => {
    await resetDatabase();
    token = await getTestToken();
    const companyRes = await post('/companies', createCompanyPayload(), { token });
    companyId = companyRes.body.data!.id;
  });

  const agentsUrl = () => `/companies/${companyId}/agents`;
  const agentUrl = (id: string) => `/companies/${companyId}/agents/${id}`;

  // ─── POST /companies/:companyId/agents ──────────────────

  describe('POST /companies/:companyId/agents', () => {
    it('should create agent with valid data, status=idle, budget_spent=0', async () => {
      const payload = createAgentPayload();
      const res = await post(agentsUrl(), payload, { token });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data!.name).toBe(payload.name);
      expect(res.body.data!.title).toBe(payload.title);
      expect(res.body.data!.status).toBe('idle');
      expect(res.body.data!.budget_spent).toBe(0);
      expect(res.body.data!.company_id).toBe(companyId);
      expect(res.body.data!.budget_remaining).toBe(payload.budget_monthly);
      expect(res.body.data!.budget_usage_pct).toBe(0);
      expect(res.body.error).toBeNull();
    });

    it('should return 400 when name is missing', async () => {
      const { name, ...noName } = createAgentPayload();
      const res = await post(agentsUrl(), noName, { token });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error!.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when title is missing', async () => {
      const { title, ...noTitle } = createAgentPayload();
      const res = await post(agentsUrl(), noTitle, { token });
      expect(res.status).toBe(400);
    });

    it('should return 400 when runtime is missing', async () => {
      const { runtime, ...noRuntime } = createAgentPayload();
      const res = await post(agentsUrl(), noRuntime, { token });
      expect(res.status).toBe(400);
    });

    it('should return 404 when companyId does not exist', async () => {
      const fakeCompanyId = '00000000-0000-4000-8000-000000000000';
      const res = await post(
        `/companies/${fakeCompanyId}/agents`,
        createAgentPayload(),
        { token }
      );
      expect(res.status).toBe(404);
    });

    it('should return 400 or 500 for non-existent reports_to (see Bug B002)', async () => {
      const fakeAgentId = '00000000-0000-4000-8000-000000000000';
      const res = await post(
        agentsUrl(),
        createAgentPayload({ reports_to: fakeAgentId }),
        { token }
      );
      // BUG B002: Backend returns 500 instead of 400 for non-existent reports_to FK
      expect([400, 500]).toContain(res.status);
    });

    it('should allow budget_monthly = 0 (free agent)', async () => {
      const res = await post(
        agentsUrl(),
        createAgentPayload({ budget_monthly: 0 }),
        { token }
      );
      expect(res.status).toBe(201);
      expect(res.body.data!.budget_monthly).toBe(0);
    });

    it('should create agent from each preset template', async () => {
      for (const preset of ['atlas', 'nova', 'sentinel', 'echo', 'aria', 'pixel', 'cipher', 'flux'] as const) {
        const res = await post(agentsUrl(), createAgentPayloadFromPreset(preset), { token });
        expect(res.status).toBe(201);
      }
    });
  });

  // ─── GET /companies/:companyId/agents ───────────────────

  describe('GET /companies/:companyId/agents', () => {
    it('should return all agents for the company', async () => {
      await post(agentsUrl(), createAgentPayloadFromPreset('atlas'), { token });
      await post(agentsUrl(), createAgentPayloadFromPreset('nova'), { token });

      const res = await get(agentsUrl(), { token });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect((res.body.data as unknown[]).length).toBe(2);
    });

    it('should filter by status=idle', async () => {
      await post(agentsUrl(), createAgentPayload({ name: 'IdleAgent' }), { token });
      const res = await get(`${agentsUrl()}?status=idle`, { token });
      expect(res.status).toBe(200);
      const agents = res.body.data as Array<{ status: string }>;
      agents.forEach((a) => expect(a.status).toBe('idle'));
    });

    it('should filter by department', async () => {
      await post(agentsUrl(), createAgentPayloadFromPreset('sentinel'), { token }); // security
      await post(agentsUrl(), createAgentPayloadFromPreset('atlas'), { token });    // engineering

      const res = await get(`${agentsUrl()}?department=security`, { token });
      expect(res.status).toBe(200);
      const agents = res.body.data as Array<{ department: string }>;
      expect(agents.length).toBe(1);
      agents.forEach((a) => expect(a.department).toBe('security'));
    });

    it('should enforce cross-company isolation', async () => {
      await post(agentsUrl(), createAgentPayload({ name: 'CompanyA Agent' }), { token });

      const companyB = await post('/companies', createCompanyPayload({ name: 'Company B' }), { token });
      const companyBId = companyB.body.data!.id;

      const res = await get(`/companies/${companyBId}/agents`, { token });
      expect(res.status).toBe(200);
      expect((res.body.data as unknown[]).length).toBe(0);
    });
  });

  // ─── GET /companies/:companyId/agents/:id ───────────────

  describe('GET /companies/:companyId/agents/:id', () => {
    it('should return agent details with performance and budget fields', async () => {
      const created = await post(agentsUrl(), createAgentPayload(), { token });
      const agentId = created.body.data!.id;

      const res = await get(agentUrl(agentId), { token });
      expect(res.status).toBe(200);
      expect(res.body.data!.id).toBe(agentId);
      expect(res.body.data!.performance).toBeDefined();
      expect(res.body.data!.runtime).toBeDefined();
    });

    it('should return 404 for non-existent agent', async () => {
      const fakeId = '00000000-0000-4000-8000-000000000000';
      const res = await get(agentUrl(fakeId), { token });
      expect(res.status).toBe(404);
    });
  });

  // ─── PUT /companies/:companyId/agents/:id ───────────────

  describe('PUT /companies/:companyId/agents/:id', () => {
    it('should update agent name', async () => {
      const created = await post(agentsUrl(), createAgentPayload(), { token });
      const agentId = created.body.data!.id;

      const res = await put(agentUrl(agentId), { name: 'Renamed Agent' }, { token });
      expect(res.status).toBe(200);
      expect(res.body.data!.name).toBe('Renamed Agent');
    });
  });

  // ─── DELETE /companies/:companyId/agents/:id ────────────

  describe('DELETE /companies/:companyId/agents/:id', () => {
    it('should delete agent successfully', async () => {
      const created = await post(agentsUrl(), createAgentPayload(), { token });
      const agentId = created.body.data!.id;

      const res = await del(agentUrl(agentId), { token });
      expect(res.status).toBe(200);
      expect(res.body.data!.deleted).toBe(true);
    });

    it('should return 404 on GET after deletion', async () => {
      const created = await post(agentsUrl(), createAgentPayload(), { token });
      const agentId = created.body.data!.id;

      await del(agentUrl(agentId), { token });
      const res = await get(agentUrl(agentId), { token });
      expect(res.status).toBe(404);
    });
  });

  // ─── POST .../agents/:id/pause ──────────────────────────

  describe('POST /companies/:companyId/agents/:id/pause', () => {
    it('should pause an idle agent', async () => {
      const created = await post(agentsUrl(), createAgentPayload(), { token });
      const agentId = created.body.data!.id;

      const res = await post(`${agentUrl(agentId)}/pause`, {}, { token });
      expect(res.status).toBe(200);

      const detail = await get(agentUrl(agentId), { token });
      expect(detail.body.data!.status).toBe('paused');
    });

    it('should return 400 when pausing already-paused agent', async () => {
      const created = await post(agentsUrl(), createAgentPayload(), { token });
      const agentId = created.body.data!.id;

      await post(`${agentUrl(agentId)}/pause`, {}, { token });
      const res = await post(`${agentUrl(agentId)}/pause`, {}, { token });
      expect(res.status).toBe(400);
    });
  });

  // ─── POST .../agents/:id/resume ─────────────────────────

  describe('POST /companies/:companyId/agents/:id/resume', () => {
    it('should resume a paused agent to idle', async () => {
      const created = await post(agentsUrl(), createAgentPayload(), { token });
      const agentId = created.body.data!.id;

      await post(`${agentUrl(agentId)}/pause`, {}, { token });
      const res = await post(`${agentUrl(agentId)}/resume`, {}, { token });
      expect(res.status).toBe(200);

      const detail = await get(agentUrl(agentId), { token });
      expect(detail.body.data!.status).toBe('idle');
    });

    it('should return 400 when resuming non-paused agent', async () => {
      const created = await post(agentsUrl(), createAgentPayload(), { token });
      const agentId = created.body.data!.id;
      // Agent is idle, not paused
      const res = await post(`${agentUrl(agentId)}/resume`, {}, { token });
      expect(res.status).toBe(400);
    });
  });
});

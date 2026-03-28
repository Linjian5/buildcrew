import { describe, it, expect, beforeEach } from 'vitest';
import { post, get, getTestToken } from '../../helpers/api';
import { createCompanyPayload, createAgentPayload, createTaskPayload } from '../../helpers/fixtures';
import { resetDatabase } from '../../helpers/db';

describe('Multi-Company Model', () => {
  let token: string;

  beforeEach(async () => {
    await resetDatabase();
    token = await getTestToken();
  });

  // ─── Groups ─────────────────────────────────────────────

  describe('Group management', () => {
    it('should create group and return 201', async () => {
      const res = await post('/groups', { name: 'Acme Holdings', total_budget: 1000 }, { token });
      expect(res.status).toBe(201);
      expect(res.body.data!.name).toBe('Acme Holdings');
      expect(res.body.data!.total_budget).toBe(1000);
      expect(res.body.data!.company_count).toBe(0);
    });

    it('should list groups', async () => {
      await post('/groups', { name: 'Group A' }, { token });
      await post('/groups', { name: 'Group B' }, { token });
      const res = await get('/groups', { token });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect((res.body.data as unknown[]).length).toBe(2);
    });

    it('group detail should include companies + summary', async () => {
      const group = await post('/groups', { name: 'Test Group' }, { token });
      const groupId = group.body.data!.id;

      // Create companies in the group
      await post('/companies', { ...createCompanyPayload({ name: 'Sub A', budget_monthly: 100 }), group_id: groupId }, { token });
      await post('/companies', { ...createCompanyPayload({ name: 'Sub B', budget_monthly: 200 }), group_id: groupId }, { token });

      const res = await get(`/groups/${groupId}`, { token });
      expect(res.status).toBe(200);
      expect(res.body.data!.name).toBe('Test Group');
      expect(res.body.data!.companies).toBeDefined();
      expect((res.body.data!.companies as unknown[]).length).toBe(2);
      expect(res.body.data!.summary).toBeDefined();
      expect(res.body.data!.summary.company_count).toBe(2);
    });

    it('different groups should be isolated', async () => {
      const gA = await post('/groups', { name: 'Group A' }, { token });
      const gB = await post('/groups', { name: 'Group B' }, { token });
      await post('/companies', { ...createCompanyPayload({ name: 'A Corp' }), group_id: gA.body.data!.id }, { token });
      await post('/companies', { ...createCompanyPayload({ name: 'B Corp' }), group_id: gB.body.data!.id }, { token });

      const resA = await get(`/groups/${gA.body.data!.id}`, { token });
      const names = (resA.body.data!.companies as Array<{ name: string }>).map((c) => c.name);
      expect(names).toContain('A Corp');
      expect(names).not.toContain('B Corp');
    });
  });

  // ─── Agent Loan ─────────────────────────────────────────

  describe('Agent loan', () => {
    let sourceCoId: string;
    let targetCoId: string;
    let agentId: string;

    beforeEach(async () => {
      const src = await post('/companies', createCompanyPayload({ name: 'Source Co' }), { token });
      sourceCoId = src.body.data!.id;
      const tgt = await post('/companies', createCompanyPayload({ name: 'Target Co' }), { token });
      targetCoId = tgt.body.data!.id;
      const ag = await post(`/companies/${sourceCoId}/agents`, createAgentPayload({ name: 'Shared Agent' }), { token });
      agentId = ag.body.data!.id;
    });

    it('should create loan and return 201', async () => {
      const res = await post(`/companies/${sourceCoId}/agents/${agentId}/loan`, {
        to_company_id: targetCoId,
        duration_hours: 24,
      }, { token });
      expect(res.status).toBe(201);
      expect(res.body.data!.status).toBe('active');
      expect(res.body.data!.from_company_id).toBe(sourceCoId);
      expect(res.body.data!.to_company_id).toBe(targetCoId);
    });

    it('should return 400 when loaning to same company', async () => {
      const res = await post(`/companies/${sourceCoId}/agents/${agentId}/loan`, {
        to_company_id: sourceCoId,
        duration_hours: 24,
      }, { token });
      expect(res.status).toBe(400);
    });

    it('should return 409 when agent already loaned', async () => {
      await post(`/companies/${sourceCoId}/agents/${agentId}/loan`, {
        to_company_id: targetCoId, duration_hours: 24,
      }, { token });
      const res = await post(`/companies/${sourceCoId}/agents/${agentId}/loan`, {
        to_company_id: targetCoId, duration_hours: 24,
      }, { token });
      expect(res.status).toBe(409);
    });
  });
});

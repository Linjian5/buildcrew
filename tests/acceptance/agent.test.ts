import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET, DEL, registerUser, createCompany, createAgent, resetDB } from './helpers/setup';

describe('Agent 管理', () => {
  let token: string; let companyId: string;
  beforeEach(async () => {
    await resetDB(); token = (await registerUser()).token;
    companyId = (await createCompany(token)).id;
  });

  it('招聘 Agent → 201, status=idle, budget_spent=0', async () => {
    const ag = await createAgent(token, companyId);
    expect(ag.status).toBe('idle');
    expect(ag.budget_spent).toBe(0);
  });

  it('列出 Agent → 只返回本公司的', async () => {
    await createAgent(token, companyId, { name: 'A1' });
    await createAgent(token, companyId, { name: 'A2' });
    const res = await GET(`/companies/${companyId}/agents`, token);
    expect((res.body.data as unknown[]).length).toBeGreaterThanOrEqual(2);
  });

  it('按 status 筛选', async () => {
    await createAgent(token, companyId);
    const res = await GET(`/companies/${companyId}/agents?status=idle`, token);
    expect(res.status).toBe(200);
    (res.body.data as any[]).forEach((a: any) => expect(a.status).toBe('idle'));
  });

  it('按 department 筛选', async () => {
    await createAgent(token, companyId, { name: 'Eng', department: 'engineering' });
    await createAgent(token, companyId, { name: 'Sec', department: 'security' });
    const res = await GET(`/companies/${companyId}/agents?department=security`, token);
    expect((res.body.data as any[]).length).toBe(1);
  });

  it('暂停 Agent → status=paused', async () => {
    const ag = await createAgent(token, companyId);
    await POST(`/companies/${companyId}/agents/${ag.id}/pause`, {}, token);
    const detail = await GET(`/companies/${companyId}/agents/${ag.id}`, token);
    expect(detail.body.data.status).toBe('paused');
  });

  it('恢复 Agent → status=idle', async () => {
    const ag = await createAgent(token, companyId);
    await POST(`/companies/${companyId}/agents/${ag.id}/pause`, {}, token);
    await POST(`/companies/${companyId}/agents/${ag.id}/resume`, {}, token);
    const detail = await GET(`/companies/${companyId}/agents/${ag.id}`, token);
    expect(detail.body.data.status).toBe('idle');
  });

  it('解雇 Agent → 200', async () => {
    const ag = await createAgent(token, companyId);
    const res = await DEL(`/companies/${companyId}/agents/${ag.id}`, token);
    expect(res.status).toBe(200);
  });

  it('跨公司访问 Agent → 不包含本公司的手动创建 Agent', async () => {
    await createAgent(token, companyId, { name: 'ManualAgent' });
    const co2 = await createCompany(token, 'OtherCo');
    const res = await GET(`/companies/${co2.id}/agents`, token);
    const names = (res.body.data as any[]).map((a: any) => a.name);
    expect(names).not.toContain('ManualAgent');
  });
});

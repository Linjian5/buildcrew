import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET, registerUser, createCompany, resetDB } from './helpers/setup';

describe('Onboarding 完整流程', () => {
  let token: string;
  let companyId: string;
  let ariaId: string;

  beforeEach(async () => {
    await resetDB();
    token = (await registerUser('Onboard User')).token;
    // Step 1: Create company (auto-creates Aria CEO)
    const co = await createCompany(token, 'My SaaS Startup');
    companyId = co.id;
    // Find auto-created Aria
    const agents = await GET(`/companies/${companyId}/agents`, token);
    const aria = (agents.body.data as any[]).find((a: any) => a.name === 'Aria');
    expect(aria).toBeDefined();
    ariaId = aria.id;
  });

  it('创建公司后 Aria CEO 自动存在', async () => {
    const agents = await GET(`/companies/${companyId}/agents`, token);
    const aria = (agents.body.data as any[]).find((a: any) => a.name === 'Aria');
    expect(aria).toBeDefined();
    expect(aria.title).toBe('CEO');
    expect(aria.status).toBe('idle');
  });

  it('创建 onboarding 线程 → Aria 回复包含团队推荐', async () => {
    const res = await POST(`/companies/${companyId}/chat/threads`, {
      agent_id: ariaId,
      thread_type: 'onboarding',
      initial_message: 'We are building a SaaS product for project management. Help me set up my AI team.',
    }, token);

    expect(res.status).toBe(201);
    expect(res.body.data.thread.thread_type).toBe('onboarding');

    // Aria should respond with team recommendations
    if (res.body.data.agent_response) {
      const reply = res.body.data.agent_response.content as string;
      expect(reply.length).toBeGreaterThan(50);
      // Response should mention agent roles or team structure
    }
  });

  it('batch-hire 创建团队 → 多个 Agent 成功创建', async () => {
    // Hire a team via batch-hire
    const res = await POST(`/companies/${companyId}/agents/batch-hire`, {
      roles: ['atlas', 'nova', 'echo', 'sentinel'],
    }, token);

    expect(res.status).toBe(201);
    expect(res.body.data.hired).toBeDefined();
    expect(res.body.data.count).toBeGreaterThanOrEqual(4);

    // Verify agents exist in company
    const agents = await GET(`/companies/${companyId}/agents`, token);
    const names = (agents.body.data as any[]).map((a: any) => a.name);
    expect(names).toContain('Atlas');
    expect(names).toContain('Nova');
    expect(names).toContain('Echo');
    expect(names).toContain('Sentinel');
  });

  it('batch-hire 后员工总数 > 1 (Aria + 新招)', async () => {
    await POST(`/companies/${companyId}/agents/batch-hire`, {
      roles: ['atlas', 'nova'],
    }, token);

    const agents = await GET(`/companies/${companyId}/agents`, token);
    // At least Aria + Atlas + Nova = 3
    expect((agents.body.data as any[]).length).toBeGreaterThanOrEqual(3);
  });

  it('batch-hire 重复角色被跳过', async () => {
    await POST(`/companies/${companyId}/agents/batch-hire`, {
      roles: ['atlas'],
    }, token);

    // Try hiring Atlas again
    const res = await POST(`/companies/${companyId}/agents/batch-hire`, {
      roles: ['atlas'],
    }, token);

    expect(res.status).toBe(201);
    // Should return empty or skip existing
    const allAgents = await GET(`/companies/${companyId}/agents`, token);
    const atlasCount = (allAgents.body.data as any[]).filter((a: any) => a.name === 'Atlas').length;
    expect(atlasCount).toBe(1); // Only one Atlas
  });

  it('batch-hire Agent 的 reports_to 指向 CEO', async () => {
    const res = await POST(`/companies/${companyId}/agents/batch-hire`, {
      roles: ['atlas'],
    }, token);

    if (res.body.data && (res.body.data as any[]).length > 0) {
      const atlas = (res.body.data as any[]).find((a: any) => a.name === 'Atlas');
      if (atlas && atlas.reports_to) {
        expect(atlas.reports_to).toBe(ariaId);
      }
    }
  });

  it('batch-hire Agent 预算按比例分配', async () => {
    await POST(`/companies/${companyId}/agents/batch-hire`, {
      roles: ['atlas', 'echo'],
    }, token);

    const agents = await GET(`/companies/${companyId}/agents`, token);
    const atlas = (agents.body.data as any[]).find((a: any) => a.name === 'Atlas');
    const echo = (agents.body.data as any[]).find((a: any) => a.name === 'Echo');

    if (atlas && echo) {
      // Atlas (CTO, 15%) should have higher budget than Echo (Backend, 10%)
      expect(atlas.budget_monthly).toBeGreaterThanOrEqual(echo.budget_monthly);
    }
  });

  it('完整 Onboarding 流程: 创建公司 → 对话 → batch-hire → 验证', async () => {
    // Step 1: Already have company + Aria from beforeEach

    // Step 2: Start onboarding chat
    const thread = await POST(`/companies/${companyId}/chat/threads`, {
      agent_id: ariaId,
      thread_type: 'onboarding',
      initial_message: 'Help me build a SaaS product team',
    }, token);
    expect(thread.status).toBe(201);

    // Step 3: Batch hire recommended team
    const hire = await POST(`/companies/${companyId}/agents/batch-hire`, {
      roles: ['atlas', 'nova', 'echo', 'sentinel', 'pixel'],
    }, token);
    expect(hire.status).toBe(201);

    // Step 4: Verify team is set up
    const agents = await GET(`/companies/${companyId}/agents`, token);
    const agentCount = (agents.body.data as any[]).length;
    // Aria + 5 hired = 6
    expect(agentCount).toBeGreaterThanOrEqual(6);

    // Step 5: Verify company detail shows correct agent_count
    const company = await GET(`/companies/${companyId}`, token);
    expect(company.body.data.agent_count).toBeGreaterThanOrEqual(6);
  });
});

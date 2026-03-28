import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET, registerUser, createCompany, createAgent, createTask, resetDB } from './helpers/setup';

describe('多公司', () => {
  let token: string;
  beforeEach(async () => { await resetDB(); token = (await registerUser()).token; });

  it('创建第 2 家公司', async () => {
    await createCompany(token, 'Co1');
    const co2 = await createCompany(token, 'Co2');
    expect(co2.id).toBeDefined();
  });

  it('两家公司数据完全隔离', async () => {
    const co1 = await createCompany(token, 'Co1');
    const co2 = await createCompany(token, 'Co2');
    await createAgent(token, co1.id, { name: 'ManualAgent1' });
    await createTask(token, co1.id, 'Task1');

    const agents2 = await GET(`/companies/${co2.id}/agents`, token);
    const tasks2 = await GET(`/companies/${co2.id}/tasks`, token);
    // Co2 should NOT have ManualAgent1 (may have auto-created CEO)
    const names2 = (agents2.body.data as any[]).map((a: any) => a.name);
    expect(names2).not.toContain('ManualAgent1');
    expect((tasks2.body.data as unknown[]).length).toBe(0);
  });

  it('切换公司后查到不同的 Agent', async () => {
    const co1 = await createCompany(token, 'CoA');
    const co2 = await createCompany(token, 'CoB');
    await createAgent(token, co1.id, { name: 'AgentA' });
    await createAgent(token, co2.id, { name: 'AgentB' });

    const a1 = await GET(`/companies/${co1.id}/agents`, token);
    const a2 = await GET(`/companies/${co2.id}/agents`, token);
    const names1 = (a1.body.data as any[]).map((a: any) => a.name);
    const names2 = (a2.body.data as any[]).map((a: any) => a.name);
    expect(names1).toContain('AgentA');
    expect(names1).not.toContain('AgentB');
    expect(names2).toContain('AgentB');
    expect(names2).not.toContain('AgentA');
  });
});

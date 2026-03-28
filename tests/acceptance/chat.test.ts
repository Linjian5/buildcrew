import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET, DEL, registerUser, createCompany, createAgent, resetDB } from './helpers/setup';

describe('对话系统', () => {
  let token: string; let companyId: string; let agentId: string;
  beforeEach(async () => {
    await resetDB(); token = (await registerUser()).token;
    companyId = (await createCompany(token)).id;
    agentId = (await createAgent(token, companyId)).id;
  });
  const threads = () => `/companies/${companyId}/chat/threads`;

  it('创建对话线程 → 201', async () => {
    const res = await POST(threads(), { agent_id: agentId, thread_type: 'question' }, token);
    expect(res.status).toBe(201);
    expect(res.body.data.thread.agent_id).toBe(agentId);
  });

  it('发消息 → 返回 Agent 回复', async () => {
    const t = await POST(threads(), { agent_id: agentId, thread_type: 'question', initial_message: 'Hello' }, token);
    const tid = t.body.data.thread.id;
    const res = await POST(`${threads()}/${tid}/messages`, { content: 'How are you?' }, token);
    expect(res.status).toBe(200);
    expect(res.body.data.agent_response).toBeDefined();
    expect(res.body.data.agent_response.content.length).toBeGreaterThan(0);
  });

  it('列出线程', async () => {
    await POST(threads(), { agent_id: agentId, thread_type: 'question' }, token);
    const res = await GET(threads(), token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('获取线程消息列表', async () => {
    const t = await POST(threads(), { agent_id: agentId, thread_type: 'question', initial_message: 'Hi' }, token);
    const res = await GET(`${threads()}/${t.body.data.thread.id}`, token);
    expect(res.status).toBe(200);
  });

  it('关闭线程', async () => {
    const t = await POST(threads(), { agent_id: agentId, thread_type: 'question' }, token);
    const res = await DEL(`${threads()}/${t.body.data.thread.id}`, token);
    expect(res.status).toBe(200);
  });

  it('不同用户对话隔离', async () => {
    await POST(threads(), { agent_id: agentId, thread_type: 'question', initial_message: 'Secret' }, token);
    const b = await registerUser();
    const bCo = await createCompany(b.token, 'BCo');
    const res = await GET(`/companies/${bCo.id}/chat/threads`, b.token);
    expect((res.body.data as unknown[]).length).toBe(0);
  });
});

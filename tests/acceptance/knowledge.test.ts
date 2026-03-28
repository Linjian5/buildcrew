import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET, DEL, registerUser, createCompany, createAgent, resetDB } from './helpers/setup';

describe('知识库', () => {
  let token: string; let companyId: string;
  beforeEach(async () => {
    await resetDB(); token = (await registerUser()).token;
    companyId = (await createCompany(token)).id;
  });
  const kUrl = () => `/companies/${companyId}/knowledge`;

  it('创建知识条目 → 201', async () => {
    const res = await POST(kUrl(), { title: 'Best Practice', content: 'Always test...', category: 'pattern' }, token);
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Best Practice');
  });

  it('列出 → 按 category 过滤', async () => {
    await POST(kUrl(), { title: 'P', content: 'C', category: 'pattern' }, token);
    await POST(kUrl(), { title: 'F', content: 'C', category: 'failure' }, token);
    const res = await GET(`${kUrl()}?category=failure`, token);
    expect(res.status).toBe(200);
    (res.body.data as any[]).forEach((e: any) => expect(e.category).toBe('failure'));
  });

  it('搜索 → 返回结果', async () => {
    await POST(kUrl(), { title: 'PostgreSQL Tips', content: 'Connection pooling...', category: 'pattern' }, token);
    const res = await GET(`${kUrl()}/search?q=postgresql`, token);
    expect(res.status).toBe(200);
  });

  it('删除/过期', async () => {
    const entry = await POST(kUrl(), { title: 'Delete Me', content: 'C', category: 'pattern' }, token);
    const res = await DEL(`${kUrl()}/${entry.body.data.id}`, token);
    expect(res.status).toBe(200);
    expect(res.body.data.expired).toBe(true);
  });

  it('公司隔离', async () => {
    await POST(kUrl(), { title: 'Secret', content: 'A only', category: 'pattern' }, token);
    const co2 = await createCompany(token, 'OtherCo');
    const res = await GET(`/companies/${co2.id}/knowledge`, token);
    const entries = res.body.data as any[];
    expect(entries.find((e: any) => e.title === 'Secret')).toBeUndefined();
  });
});

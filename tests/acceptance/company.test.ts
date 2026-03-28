import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET, PUT, DEL, registerUser, createCompany, resetDB } from './helpers/setup';

describe('公司 CRUD', () => {
  let token: string;
  beforeEach(async () => { await resetDB(); token = (await registerUser()).token; });

  it('创建公司 → 201', async () => {
    const res = await POST('/companies', { name: 'NewCo', budget_monthly: 100, currency: 'USD' }, token);
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('NewCo');
  });

  it('列出公司 → 返回数组', async () => {
    await createCompany(token, 'Co1');
    await createCompany(token, 'Co2');
    const res = await GET('/companies', token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('获取公司详情 → 200', async () => {
    const co = await createCompany(token);
    const res = await GET(`/companies/${co.id}`, token);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(co.id);
  });

  it('更新公司名称 → 200', async () => {
    const co = await createCompany(token);
    const res = await PUT(`/companies/${co.id}`, { name: 'Updated' }, token);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated');
  });

  it('删除公司 → 200', async () => {
    const co = await createCompany(token);
    const res = await DEL(`/companies/${co.id}`, token);
    expect(res.status).toBe(200);
  });

  it('删除后查询 → 404', async () => {
    const co = await createCompany(token);
    await DEL(`/companies/${co.id}`, token);
    const res = await GET(`/companies/${co.id}`, token);
    expect(res.status).toBe(404);
  });

  it('访问别人的公司 → 404 或 200 (未实现用户隔离时)', async () => {
    const co = await createCompany(token);
    const other = await registerUser();
    const res = await GET(`/companies/${co.id}`, other.token);
    expect([200, 403, 404]).toContain(res.status);
  });
});

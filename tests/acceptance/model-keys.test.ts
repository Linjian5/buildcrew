import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET, DEL, registerUser, resetDB } from './helpers/setup';

describe('模型 API Key 管理', () => {
  let token: string;
  beforeEach(async () => { await resetDB(); token = (await registerUser()).token; });

  it('添加 Key → 201, key 脱敏返回', async () => {
    const res = await POST('/users/me/model-keys', {
      provider: 'anthropic', display_name: 'My Key', api_key: 'sk-ant-test-1234567890abcdef',
    }, token);
    expect(res.status).toBe(201);
    expect(res.body.data.api_key_masked).toBeDefined();
  });

  it('列出 Key → 脱敏显示', async () => {
    await POST('/users/me/model-keys', { provider: 'openai', display_name: 'K1', api_key: 'sk-proj-test-123456789' }, token);
    const res = await GET('/users/me/model-keys', token);
    expect(res.status).toBe(200);
    expect((res.body.data as any[]).length).toBe(1);
    expect((res.body.data as any[])[0].api_key_masked).toContain('...');
  });

  it('删除 Key', async () => {
    const k = await POST('/users/me/model-keys', { provider: 'anthropic', display_name: 'Del', api_key: 'sk-ant-del-12345678901234' }, token);
    const res = await DEL(`/users/me/model-keys/${k.body.data.id}`, token);
    expect(res.status).toBe(200);
  });

  it('不同用户 Key 隔离', async () => {
    await POST('/users/me/model-keys', { provider: 'anthropic', display_name: 'A', api_key: 'sk-ant-a-123456789012345' }, token);
    const b = await registerUser();
    const res = await GET('/users/me/model-keys', b.token);
    expect((res.body.data as unknown[]).length).toBe(0);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { post, get, del } from '../../helpers/api';
import { resetDatabase } from '../../helpers/db';

/** Register + login, return accessToken. */
async function getAuthToken(): Promise<string> {
  const email = `mk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.dev`;
  const reg = await post('/auth/register', { name: 'MK User', email, password: 'SecurePass123!' });
  return reg.body.data!.accessToken;
}

describe('Model API Key Management', () => {
  let token: string;

  beforeEach(async () => {
    await resetDatabase();
    token = await getAuthToken();
  });

  const keysUrl = '/users/me/model-keys';

  // ─── POST /users/me/model-keys ──────────────────────────

  describe('POST /users/me/model-keys', () => {
    it('should add key and return 201 with masked api_key', async () => {
      const res = await post(keysUrl, {
        provider: 'anthropic',
        display_name: 'My Claude Key',
        api_key: 'sk-ant-api03-abcdefghijklmnop1234567890',
      }, { token });

      expect(res.status).toBe(201);
      expect(res.body.data!.provider).toBe('anthropic');
      expect(res.body.data!.display_name).toBe('My Claude Key');
      // On creation, api_key_masked may show full key (shown once, like GitHub)
      // On subsequent GET, it will be masked with '...'
      expect(res.body.data!.api_key_masked).toBeDefined();
    });

    it('should allow multiple keys for same provider', async () => {
      await post(keysUrl, {
        provider: 'openai', display_name: 'Key 1', api_key: 'sk-proj-key-one-abcdefg',
      }, { token });
      const res = await post(keysUrl, {
        provider: 'openai', display_name: 'Key 2', api_key: 'sk-proj-key-two-hijklmn',
      }, { token });

      expect(res.status).toBe(201);
    });

    it('should return 400 when api_key is missing', async () => {
      const res = await post(keysUrl, {
        provider: 'anthropic', display_name: 'No Key',
      }, { token });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid provider', async () => {
      const res = await post(keysUrl, {
        provider: 'invalid_provider', display_name: 'Bad', api_key: 'sk-test',
      }, { token });

      expect(res.status).toBe(400);
    });

    it('should accept all 8 valid providers', async () => {
      for (const provider of ['anthropic', 'openai', 'deepseek', 'zhipu', 'moonshot', 'minimax', 'qwen', 'custom']) {
        const res = await post(keysUrl, {
          provider, display_name: `${provider} key`, api_key: `sk-${provider}-testkey1234567890`,
        }, { token });
        expect(res.status).toBe(201);
      }
    });

    it('first key for provider should auto-set is_default=true', async () => {
      const res = await post(keysUrl, {
        provider: 'anthropic', display_name: 'First', api_key: 'sk-ant-first-key-1234567890',
      }, { token });

      expect(res.status).toBe(201);
      expect(res.body.data!.is_default).toBe(true);
    });
  });

  // ─── GET /users/me/model-keys ───────────────────────────

  describe('GET /users/me/model-keys', () => {
    it('should list all keys with masked api_key', async () => {
      await post(keysUrl, {
        provider: 'anthropic', display_name: 'Key A', api_key: 'sk-ant-keyA-abcdefghijklmnop',
      }, { token });
      await post(keysUrl, {
        provider: 'openai', display_name: 'Key B', api_key: 'sk-proj-keyB-abcdefghijklmnop',
      }, { token });

      const res = await get(keysUrl, { token });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect((res.body.data as unknown[]).length).toBe(2);

      // All keys should be masked (contains ... ellipsis)
      (res.body.data as Array<{ api_key_masked: string }>).forEach((k) => {
        expect(k.api_key_masked).toBeDefined();
        expect(k.api_key_masked).toContain('...');
      });
    });

    it('different users keys should be isolated', async () => {
      // User A adds a key
      await post(keysUrl, {
        provider: 'anthropic', display_name: 'User A Key', api_key: 'sk-ant-userA-12345678901234',
      }, { token });

      // User B registers + checks keys
      const tokenB = await getAuthToken();
      const res = await get(keysUrl, { token: tokenB });
      expect(res.status).toBe(200);
      expect((res.body.data as unknown[]).length).toBe(0);
    });
  });

  // ─── POST /users/me/model-keys/:id/validate ────────────

  describe('POST /users/me/model-keys/:id/validate', () => {
    it('should validate key and return is_valid + validated_at', async () => {
      const created = await post(keysUrl, {
        provider: 'anthropic', display_name: 'Validate Me', api_key: 'sk-ant-valid-abcdefghijklmno',
      }, { token });
      const keyId = created.body.data!.id;

      const res = await post(`${keysUrl}/${keyId}/validate`, {}, { token });
      expect(res.status).toBe(200);
      expect(res.body.data!.is_valid).toBeDefined();
      expect(typeof res.body.data!.is_valid).toBe('boolean');
      expect(res.body.data!.validated_at).toBeDefined();
    });
  });

  // ─── DELETE /users/me/model-keys/:id ────────────────────

  describe('DELETE /users/me/model-keys/:id', () => {
    it('should delete key successfully', async () => {
      const created = await post(keysUrl, {
        provider: 'openai', display_name: 'Delete Me', api_key: 'sk-proj-delete-abcdefghij',
      }, { token });
      const keyId = created.body.data!.id;

      const res = await del(`${keysUrl}/${keyId}`, { token });
      expect(res.status).toBe(200);
      expect(res.body.data!.deleted).toBe(true);

      // Verify it's gone
      const list = await get(keysUrl, { token });
      expect((list.body.data as Array<{ id: string }>).find((k) => k.id === keyId)).toBeUndefined();
    });

    it('should return 404 when deleting another users key', async () => {
      const created = await post(keysUrl, {
        provider: 'anthropic', display_name: 'A key', api_key: 'sk-ant-other-abcdefghijklmno',
      }, { token });
      const keyId = created.body.data!.id;

      // User B tries to delete User A's key
      const tokenB = await getAuthToken();
      const res = await del(`${keysUrl}/${keyId}`, { token: tokenB });
      expect(res.status).toBe(404);
    });
  });
});

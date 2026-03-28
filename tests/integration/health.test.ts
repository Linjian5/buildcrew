import { describe, it, expect } from 'vitest';
import { get } from '../helpers/api';

describe('Health Check API', () => {
  it('GET /health should return 200', async () => {
    const res = await get('/health');
    expect(res.status).toBe(200);
  });
});

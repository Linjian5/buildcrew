/**
 * API test helper — lightweight HTTP client for integration tests.
 * Includes automatic retry on rate limit (429) responses.
 */

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3100/api/v1';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

interface ApiResponse<T = unknown> {
  status: number;
  headers: Headers;
  body: {
    data: T | null;
    error: { code: string; message: string } | null;
    meta?: { page: number; limit: number; total: number };
  };
}

interface RequestOptions {
  headers?: Record<string, string>;
  token?: string;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });

    // Handle rate limiting with retry
    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = res.headers.get('retry-after');
      const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : RETRY_DELAY_MS;
      await sleep(waitMs);
      continue;
    }

    // Handle non-JSON responses (e.g., rate limit plain text)
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      return {
        status: res.status,
        headers: res.headers,
        body: {
          data: null,
          error: { code: 'NON_JSON_RESPONSE', message: text },
        } as ApiResponse<T>['body'],
      };
    }

    const responseBody = await res.json();
    return {
      status: res.status,
      headers: res.headers,
      body: responseBody as ApiResponse<T>['body'],
    };
  }

  // Should not reach here, but just in case
  throw new Error(`Request to ${method} ${path} failed after ${MAX_RETRIES} retries`);
}

/** GET request */
export function get<T = unknown>(path: string, options?: RequestOptions) {
  return request<T>('GET', path, undefined, options);
}

/** POST request */
export function post<T = unknown>(
  path: string,
  body?: unknown,
  options?: RequestOptions
) {
  return request<T>('POST', path, body, options);
}

/** PUT request */
export function put<T = unknown>(
  path: string,
  body?: unknown,
  options?: RequestOptions
) {
  return request<T>('PUT', path, body, options);
}

/** DELETE request */
export function del<T = unknown>(path: string, options?: RequestOptions) {
  return request<T>('DELETE', path, undefined, options);
}

/** PATCH request */
export function patch<T = unknown>(
  path: string,
  body?: unknown,
  options?: RequestOptions
) {
  return request<T>('PATCH', path, body, options);
}

// ─── Auth helpers ─────────────────────────────────────────

/**
 * Register a new test user and return their accessToken.
 * Each call creates a unique user.
 */
export async function getTestToken(): Promise<string> {
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@buildcrew.test`;
  const res = await post('/auth/register', {
    name: 'Test User',
    email,
    password: 'SecurePass123!',
  });
  return res.body.data!.accessToken;
}

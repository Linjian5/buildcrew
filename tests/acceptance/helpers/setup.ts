/**
 * Acceptance test helpers — each test creates independent users/data.
 */

const BASE = process.env.API_BASE_URL ?? 'http://localhost:3100/api/v1';
const MAX_RETRIES = 5;
const RETRY_MS = 12000; // Wait full rate-limit window slice

// ─── HTTP helpers ─────────────────────────────────────────

export async function api(
  method: string,
  path: string,
  body?: unknown,
  token?: string
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });

    // Retry on rate limit
    if (res.status === 429 && attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_MS));
      continue;
    }

    const ct = res.headers.get('content-type') ?? '';
    const json = ct.includes('json') ? await res.json() : { data: null, error: { code: 'NON_JSON', message: await res.text() } };
    return { status: res.status, body: json as { data: any; error: any; meta?: any } };
  }

  throw new Error(`Request to ${method} ${path} failed after ${MAX_RETRIES} retries (rate limited)`);
}

export const GET = (p: string, t?: string) => api('GET', p, undefined, t);
export const POST = (p: string, b?: unknown, t?: string) => api('POST', p, b, t);
export const PUT = (p: string, b?: unknown, t?: string) => api('PUT', p, b, t);
export const DEL = (p: string, t?: string) => api('DELETE', p, undefined, t);

// ─── Auth helpers ─────────────────────────────────────────

export function uniqueEmail(prefix = 'acc') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`;
}

/** Register a new user, return { token, userId, email }. */
export async function registerUser(name = 'Test User') {
  const email = uniqueEmail();
  const res = await POST('/auth/register', { name, email, password: 'TestPass123!' });
  if (!res.body.data) {
    throw new Error(`registerUser failed (${res.status}): ${JSON.stringify(res.body.error)}`);
  }
  return {
    token: res.body.data.accessToken as string,
    refreshToken: res.body.data.refreshToken as string,
    userId: res.body.data.user.id as string,
    email,
  };
}

// ─── Data factory ─────────────────────────────────────────

export async function createCompany(token: string, name?: string) {
  const res = await POST('/companies', {
    name: name ?? `Co-${Date.now()}`,
    mission: 'Test mission',
    industry: 'saas',
    budget_monthly: 500,
    currency: 'USD',
  }, token);
  return res.body.data;
}

export async function createAgent(token: string, companyId: string, overrides: Record<string, unknown> = {}) {
  const res = await POST(`/companies/${companyId}/agents`, {
    name: 'Atlas',
    title: 'CTO',
    department: 'engineering',
    level: 'executive',
    runtime: { type: 'openai-compatible', model: 'claude-opus-4', endpoint: 'https://api.anthropic.com/v1' },
    budget_monthly: 50,
    heartbeat_interval_seconds: 300,
    max_concurrent_tasks: 1,
    ...overrides,
  }, token);
  return res.body.data;
}

export async function createTask(token: string, companyId: string, title?: string) {
  const res = await POST(`/companies/${companyId}/tasks`, {
    title: title ?? `Task-${Date.now()}`,
    description: 'Test task',
    priority: 'high',
  }, token);
  return res.body.data;
}

export async function assignTask(token: string, companyId: string, taskId: string, agentId: string) {
  return POST(`/companies/${companyId}/tasks/${taskId}/assign`, { agent_id: agentId }, token);
}

export async function completeTask(token: string, companyId: string, taskId: string) {
  return POST(`/companies/${companyId}/tasks/${taskId}/complete`, {}, token);
}

export async function heartbeat(token: string, companyId: string, agentId: string, cost = 0) {
  return POST(`/companies/${companyId}/agents/${agentId}/heartbeat`, {
    agent_id: agentId,
    status: 'idle',
    current_task_id: null,
    token_usage: { prompt_tokens: 100, completion_tokens: 50, cost_usd: cost },
  }, token);
}

// ─── DB reset ─────────────────────────────────────────────

export async function resetDB() {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: 'postgresql://localhost:5432/buildcrew_test' });
  try {
    await client.connect();
    await client.query(`TRUNCATE TABLE subscriptions, chat_messages, chat_threads, usage_records, model_api_keys, api_keys, agent_loans, experiment_assignments, experiments, task_scores, knowledge_entries, groups, users, approvals, reviews, guardian_alerts, guardian_policies, routing_decisions, agent_profiles, conversations, configs, tasks, projects, goals, agents, companies CASCADE;`);
    await client.query(`ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS embedding vector(1536);`);
  } finally {
    await client.end();
  }
}

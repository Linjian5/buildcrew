/**
 * Test data factory — creates objects matching the API contract.
 * All fields align with the interface contract in the collaboration board.
 */

import { randomUUID } from 'crypto';

// ─── Company ──────────────────────────────────────────────

export interface TestCompany {
  id: string;
  name: string;
  mission: string;
  industry: string;
  budget_monthly: number;
  currency: string;
  agent_count: number;
  active_agent_count: number;
  created_at: string;
  updated_at: string;
}

export function createTestCompany(
  overrides: Partial<TestCompany> = {}
): TestCompany {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    name: `Test Company ${Date.now()}`,
    mission: 'Build an AI-powered product',
    industry: 'saas',
    budget_monthly: 500.0,
    currency: 'USD',
    agent_count: 0,
    active_agent_count: 0,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

/** Returns a minimal POST /companies request body. */
export function createCompanyPayload(
  overrides: Partial<{
    name: string;
    mission: string;
    industry: string;
    budget_monthly: number;
    currency: string;
  }> = {}
) {
  return {
    name: `Test Company ${Date.now()}`,
    mission: 'Build an AI-powered product',
    industry: 'saas',
    budget_monthly: 500.0,
    currency: 'USD',
    ...overrides,
  };
}

// ─── Agent ────────────────────────────────────────────────

export interface TestAgent {
  id: string;
  company_id: string;
  name: string;
  title: string;
  department: string;
  level: string;
  reports_to: string | null;
  status: string;
  current_task_id: string | null;
  runtime: {
    type: string;
    model: string;
    endpoint: string;
  };
  budget_monthly: number;
  budget_spent: number;
  budget_remaining: number;
  budget_usage_pct: number;
  heartbeat_interval_seconds: number;
  last_heartbeat_at: string | null;
  performance: {
    overall_score: number;
    trend: string;
    tasks_completed: number;
    success_rate: number;
    avg_task_duration_ms: number;
  };
  created_at: string;
  updated_at: string;
}

export function createTestAgent(
  overrides: Partial<TestAgent> = {}
): TestAgent {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    company_id: randomUUID(),
    name: 'Atlas',
    title: 'CTO',
    department: 'engineering',
    level: 'executive',
    reports_to: null,
    status: 'idle',
    current_task_id: null,
    runtime: {
      type: 'openai-compatible',
      model: 'claude-opus-4',
      endpoint: 'https://api.anthropic.com/v1',
    },
    budget_monthly: 50.0,
    budget_spent: 0,
    budget_remaining: 50.0,
    budget_usage_pct: 0,
    heartbeat_interval_seconds: 300,
    last_heartbeat_at: null,
    performance: {
      overall_score: 0,
      trend: 'stable',
      tasks_completed: 0,
      success_rate: 0,
      avg_task_duration_ms: 0,
    },
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

/** Returns a minimal POST /companies/:id/agents request body. */
export function createAgentPayload(
  overrides: Partial<{
    name: string;
    title: string;
    department: string;
    level: string;
    reports_to: string | null;
    runtime: { type: string; model: string; endpoint: string };
    budget_monthly: number;
    heartbeat_interval_seconds: number;
    max_concurrent_tasks: number;
    role_template_id: string | null;
  }> = {}
) {
  return {
    name: 'Atlas',
    title: 'CTO',
    department: 'engineering',
    level: 'executive',
    reports_to: null,
    runtime: {
      type: 'openai-compatible',
      model: 'claude-opus-4',
      endpoint: 'https://api.anthropic.com/v1',
    },
    budget_monthly: 50.0,
    heartbeat_interval_seconds: 300,
    max_concurrent_tasks: 2,
    role_template_id: null,
    ...overrides,
  };
}

// ─── Task ─────────────────────────────────────────────────

export interface TestTask {
  id: string;
  company_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigned_agent_id: string | null;
  goal_id: string | null;
  project_id: string | null;
  goal_ancestry: string[];
  cost_actual: number;
  cost_estimated: number;
  duration_ms: number;
  score: {
    overall: number;
    correctness: number;
    code_quality: number;
    efficiency: number;
    cost_efficiency: number;
  } | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function createTestTask(
  overrides: Partial<TestTask> = {}
): TestTask {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    company_id: randomUUID(),
    title: 'Implement auth module',
    description: 'Implement JWT-based authentication',
    status: 'backlog',
    priority: 'medium',
    assigned_agent_id: null,
    goal_id: null,
    project_id: null,
    goal_ancestry: [],
    cost_actual: 0,
    cost_estimated: 2.0,
    duration_ms: 0,
    score: null,
    started_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

/** Returns a minimal POST /companies/:id/tasks request body. */
export function createTaskPayload(
  overrides: Partial<{
    title: string;
    description: string;
    priority: string;
    goal_id: string;
    project_id: string;
    assigned_agent_id: string | null;
    estimated_cost: number;
  }> = {}
) {
  return {
    title: 'Implement auth module',
    description: 'Implement JWT-based authentication',
    priority: 'high',
    assigned_agent_id: null,
    estimated_cost: 2.0,
    ...overrides,
  };
}

// ─── Agent Presets (8 role templates) ─────────────────────

export const AGENT_PRESETS = {
  atlas: { name: 'Atlas', title: 'CTO', department: 'engineering', level: 'executive' },
  nova: { name: 'Nova', title: 'Lead Engineer', department: 'engineering', level: 'senior' },
  sentinel: { name: 'Sentinel', title: 'Security Lead', department: 'security', level: 'senior' },
  echo: { name: 'Echo', title: 'QA Engineer', department: 'qa', level: 'mid' },
  aria: { name: 'Aria', title: 'CEO', department: 'executive', level: 'executive' },
  pixel: { name: 'Pixel', title: 'UI Designer', department: 'design', level: 'mid' },
  cipher: { name: 'Cipher', title: 'Data Engineer', department: 'data', level: 'senior' },
  flux: { name: 'Flux', title: 'DevOps Engineer', department: 'operations', level: 'mid' },
} as const;

/** Create agent payload from a named preset. */
export function createAgentPayloadFromPreset(
  preset: keyof typeof AGENT_PRESETS,
  overrides: Partial<ReturnType<typeof createAgentPayload>> = {}
) {
  return createAgentPayload({ ...AGENT_PRESETS[preset], ...overrides });
}

// ─── Task Status Presets ──────────────────────────────────

export const TASK_STATUS_PRESETS = {
  backlog: { status: 'backlog', assigned_agent_id: null, started_at: null, completed_at: null },
  in_progress: { status: 'in_progress', started_at: new Date().toISOString(), completed_at: null },
  in_review: { status: 'in_review', started_at: new Date().toISOString(), completed_at: null },
  done: { status: 'done', started_at: new Date(Date.now() - 3600000).toISOString(), completed_at: new Date().toISOString() },
  blocked: { status: 'blocked', started_at: new Date().toISOString(), completed_at: null },
} as const;

// ─── Heartbeat ────────────────────────────────────────────

export interface TestHeartbeatPayload {
  agent_id: string;
  status: 'idle' | 'working';
  current_task_id: string | null;
  token_usage: {
    prompt_tokens: number;
    completion_tokens: number;
    cost_usd: number;
  };
}

export function createHeartbeatPayload(
  overrides: Partial<TestHeartbeatPayload> = {}
): TestHeartbeatPayload {
  return {
    agent_id: randomUUID(),
    status: 'idle',
    current_task_id: null,
    token_usage: {
      prompt_tokens: 1200,
      completion_tokens: 800,
      cost_usd: 0.04,
    },
    ...overrides,
  };
}

export interface TestHeartbeatResponse {
  data: {
    action: 'continue' | 'new_task' | 'pause' | 'stop';
    task: TestTask | null;
    knowledge_context: unknown[];
    message: string | null;
  };
}

// ─── Auth / User ──────────────────────────────────────────

/** Generate a unique test email. */
export function testEmail(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@buildcrew.test`;
}

export function createRegisterPayload(
  overrides: Partial<{ name: string; email: string; password: string }> = {}
) {
  return {
    name: 'Test User',
    email: testEmail(),
    password: 'SecurePass123!',
    ...overrides,
  };
}

// ─── Knowledge ────────────────────────────────────────────

export function createKnowledgePayload(
  overrides: Partial<{
    title: string;
    content: string;
    category: string;
    source_task_id: string;
    source_agent_id: string;
  }> = {}
) {
  return {
    title: `Knowledge ${Date.now()}`,
    content: 'Useful insight extracted from task execution...',
    category: 'pattern',
    ...overrides,
  };
}

// ─── Experiment ───────────────────────────────────────────

export function createExperimentPayload(
  overrides: Partial<{
    name: string;
    description: string;
    variant_a: Record<string, unknown>;
    variant_b: Record<string, unknown>;
  }> = {}
) {
  return {
    name: `Experiment ${Date.now()}`,
    description: 'A/B test for model comparison',
    variant_a: { model: 'claude-opus-4', config: {} },
    variant_b: { model: 'gpt-4o', config: {} },
    ...overrides,
  };
}

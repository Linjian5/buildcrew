/**
 * Test database utilities.
 * Provides reset/seed functions for integration tests.
 */

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://localhost:5432/buildcrew_test';

/**
 * Reset the test database — truncate all tables in correct order.
 * Uses explicit table names to avoid deadlocks with the running server.
 */
export async function resetDatabase(): Promise<void> {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });

  try {
    await client.connect();
    // Truncate in reverse dependency order to avoid FK issues
    // CASCADE handles remaining references
    await client.query(`
      TRUNCATE TABLE subscriptions, chat_messages, chat_threads, usage_records, model_api_keys, api_keys, agent_loans, experiment_assignments, experiments, task_scores, knowledge_entries, groups, users, approvals, reviews, guardian_alerts, guardian_policies, routing_decisions, agent_profiles, conversations, configs, tasks, projects, goals, agents, companies CASCADE;
    `);
    // Ensure pgvector column exists (drizzle-kit doesn't push vector columns)
    await client.query(`
      ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS embedding vector(1536);
    `);
  } finally {
    await client.end();
  }
}

/**
 * Seed the database with minimal test data.
 * Returns IDs of created entities for use in tests.
 */
export async function seedDatabase(): Promise<{
  companyId: string;
  agentId: string;
  taskId: string;
}> {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });

  try {
    await client.connect();

    const companyRes = await client.query(
      `INSERT INTO companies (name, mission, industry, budget_monthly, currency)
       VALUES ('Test Corp', 'Test mission', 'saas', 500.00, 'USD')
       RETURNING id`
    );
    const companyId = companyRes.rows[0]!.id as string;

    const agentRes = await client.query(
      `INSERT INTO agents (company_id, name, title, department, level, status, runtime_config, budget_monthly)
       VALUES ($1, 'Test Agent', 'CTO', 'engineering', 'executive', 'idle', '{"type":"openai-compatible","model":"claude-opus-4","endpoint":"https://api.anthropic.com/v1"}', 50.00)
       RETURNING id`,
      [companyId]
    );
    const agentId = agentRes.rows[0]!.id as string;

    const taskRes = await client.query(
      `INSERT INTO tasks (company_id, assigned_agent_id, title, description, status, priority)
       VALUES ($1, $2, 'Test Task', 'A test task description', 'backlog', 'medium')
       RETURNING id`,
      [companyId, agentId]
    );
    const taskId = taskRes.rows[0]!.id as string;

    return { companyId, agentId, taskId };
  } finally {
    await client.end();
  }
}

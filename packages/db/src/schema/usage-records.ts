import { pgTable, uuid, text, integer, decimal, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { companies } from './companies';
import { agents } from './agents';
import { tasks } from './tasks';

export const usageRecords = pgTable(
  'usage_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id),
    taskId: uuid('task_id').references(() => tasks.id),
    modelKeyId: uuid('model_key_id'),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    costUsd: decimal('cost_usd', { precision: 10, scale: 6 }).notNull().default('0'),
    requestType: text('request_type'), // 'heartbeat' | 'task_execution' | 'review' | 'knowledge_extraction'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_usage_user').on(table.userId),
    index('idx_usage_company').on(table.companyId),
    index('idx_usage_agent').on(table.agentId),
    index('idx_usage_date').on(table.createdAt),
  ],
);

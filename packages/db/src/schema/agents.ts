import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { pgTable, uuid, text, decimal, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';

export const agents = pgTable(
  'agents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    title: text('title').notNull(),
    department: text('department'),
    level: text('level').default('junior'),
    reportsTo: uuid('reports_to').references((): AnyPgColumn => agents.id),
    status: text('status').default('idle'),
    runtimeConfig: jsonb('runtime_config').notNull(),
    budgetMonthly: decimal('budget_monthly', { precision: 10, scale: 2 }).default('0'),
    budgetSpent: decimal('budget_spent', { precision: 10, scale: 2 }).default('0'),
    heartbeatIntervalSec: integer('heartbeat_interval_sec').default(300),
    maxConcurrentTasks: integer('max_concurrent_tasks').default(1),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
    roleTemplateId: uuid('role_template_id'),
    appearance: jsonb('appearance').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_agents_company').on(table.companyId),
    index('idx_agents_status').on(table.companyId, table.status),
  ],
);

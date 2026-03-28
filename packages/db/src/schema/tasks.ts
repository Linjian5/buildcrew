import { pgTable, uuid, text, decimal, bigint, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { projects } from './projects';
import { goals } from './goals';
import { agents } from './agents';

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id),
    goalId: uuid('goal_id').references(() => goals.id),
    assignedAgentId: uuid('assigned_agent_id').references(() => agents.id),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').default('backlog'),
    priority: text('priority').default('medium'),
    costEstimated: decimal('cost_estimated', { precision: 10, scale: 4 }).default('0'),
    costActual: decimal('cost_actual', { precision: 10, scale: 4 }).default('0'),
    durationMs: bigint('duration_ms', { mode: 'number' }).default(0),
    result: text('result'), // task deliverable (markdown)
    score: jsonb('score'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    statusChangedAt: timestamp('status_changed_at', { withTimezone: true }).defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_tasks_company').on(table.companyId),
    index('idx_tasks_status').on(table.companyId, table.status),
    index('idx_tasks_agent').on(table.assignedAgentId),
  ],
);

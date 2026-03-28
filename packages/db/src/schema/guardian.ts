import { pgTable, uuid, text, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { agents } from './agents';
import { tasks } from './tasks';

export const guardianAlerts = pgTable(
  'guardian_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id').references(() => agents.id),
    taskId: uuid('task_id').references(() => tasks.id),
    severity: text('severity').notNull(), // 'info' | 'warning' | 'critical' | 'emergency'
    category: text('category').notNull(), // 'behavior' | 'security' | 'cost' | 'loop'
    description: text('description').notNull(),
    evidence: jsonb('evidence').default({}),
    autoAction: text('auto_action'), // 'log_only' | 'throttle' | 'pause_agent' | 'kill_task'
    resolved: boolean('resolved').default(false),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: text('resolved_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_guardian_alerts_company').on(table.companyId),
    index('idx_guardian_alerts_severity').on(table.companyId, table.severity),
    index('idx_guardian_alerts_resolved').on(table.companyId, table.resolved),
  ],
);

export const guardianPolicies = pgTable(
  'guardian_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    policyType: text('policy_type').notNull(), // 'cost_limit' | 'loop_detection' | 'file_access' | 'budget_warning'
    config: jsonb('config').notNull(),
    enabled: boolean('enabled').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_guardian_policies_company').on(table.companyId)],
);

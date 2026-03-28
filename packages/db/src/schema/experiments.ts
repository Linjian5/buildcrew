import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';

export const experiments = pgTable(
  'experiments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').default('running'), // 'running' | 'completed'
    configA: jsonb('config_a').notNull(),
    configB: jsonb('config_b').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_experiments_company').on(table.companyId)],
);

export const experimentAssignments = pgTable(
  'experiment_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    experimentId: uuid('experiment_id')
      .notNull()
      .references(() => experiments.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').notNull(),
    variant: text('variant').notNull(), // 'a' | 'b'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_experiment_assignments_experiment').on(table.experimentId)],
);

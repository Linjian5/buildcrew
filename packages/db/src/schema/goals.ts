import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { pgTable, uuid, text, decimal, timestamp, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';

export const goals = pgTable(
  'goals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    parentGoalId: uuid('parent_goal_id').references((): AnyPgColumn => goals.id),
    title: text('title').notNull(),
    description: text('description'),
    progressPct: decimal('progress_pct', { precision: 5, scale: 2 }).default('0'),
    status: text('status').default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_goals_company').on(table.companyId)],
);

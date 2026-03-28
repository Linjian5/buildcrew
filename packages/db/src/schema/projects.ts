import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { goals } from './goals';

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  goalId: uuid('goal_id').references(() => goals.id),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

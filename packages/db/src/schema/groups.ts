import { pgTable, uuid, text, decimal, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  totalBudget: decimal('total_budget', { precision: 10, scale: 2 }).default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

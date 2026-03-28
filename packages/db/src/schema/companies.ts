import { pgTable, uuid, text, decimal, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'), // owner — nullable for backward compat, will be required after auth migration
  groupId: uuid('group_id'), // optional group membership
  name: text('name').notNull(),
  mission: text('mission'),
  industry: text('industry'),
  template: text('template'), // saas | ecommerce | content | design | custom
  budgetMonthly: decimal('budget_monthly', { precision: 10, scale: 2 }).default('0'),
  currency: text('currency').default('USD'),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

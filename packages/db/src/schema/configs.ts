import { pgTable, uuid, text, jsonb, integer, timestamp } from 'drizzle-orm/pg-core';
import { companies } from './companies';

export const configs = pgTable('configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(), // 'agent' | 'company' | 'guardian'
  entityId: uuid('entity_id').notNull(),
  configData: jsonb('config_data').notNull(),
  version: integer('version').default(1),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

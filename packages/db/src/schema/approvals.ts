import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';

export const approvals = pgTable(
  'approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    source: text('source').notNull(), // 'review_human_gate' | 'guardian_critical' | 'agent_hire'
    sourceId: uuid('source_id').notNull(), // ID of the review/alert/request
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').default('pending'), // 'pending' | 'approved' | 'rejected'
    metadata: jsonb('metadata').default({}),
    decidedBy: text('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_approvals_company').on(table.companyId),
    index('idx_approvals_status').on(table.status),
  ],
);

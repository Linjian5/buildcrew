import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { tasks } from './tasks';
import { agents } from './agents';

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    stage: text('stage').notNull(), // 'auto_check' | 'peer_review' | 'human_gate'
    status: text('status').default('pending'), // 'pending' | 'passed' | 'failed'
    reviewerAgentId: uuid('reviewer_agent_id').references(() => agents.id),
    comments: jsonb('comments').default([]).$type<ReviewComment[]>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_reviews_company').on(table.companyId),
    index('idx_reviews_task').on(table.taskId),
    index('idx_reviews_status').on(table.companyId, table.status),
  ],
);

export interface ReviewComment {
  author: string;
  content: string;
  timestamp: string;
}

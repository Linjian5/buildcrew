import { pgTable, uuid, text, integer, real, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { tasks } from './tasks';
import { agents } from './agents';

export const knowledgeEntries = pgTable(
  'knowledge_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    category: text('category').notNull(), // 'pattern' | 'quirk' | 'config' | 'failure' | 'adr' | 'glossary'
    title: text('title').notNull(),
    content: text('content').notNull(),
    // embedding stored as raw SQL — drizzle doesn't natively support vector type
    // We'll use raw SQL for embedding operations
    sourceTaskId: uuid('source_task_id').references(() => tasks.id),
    sourceAgentId: uuid('source_agent_id').references(() => agents.id),
    relevanceTags: jsonb('relevance_tags').default([]).$type<string[]>(),
    citationCount: integer('citation_count').default(0),
    confidence: real('confidence').default(0.5),
    expired: boolean('expired').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_knowledge_company_category').on(table.companyId, table.category),
    index('idx_knowledge_company').on(table.companyId),
  ],
);

import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { tasks } from './tasks';
import { agents } from './agents';

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id').references(() => agents.id),
    role: text('role').notNull(), // 'agent' | 'system' | 'user'
    content: text('content').notNull(),
    tokenUsage: jsonb('token_usage'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_conversations_task').on(table.taskId)],
);

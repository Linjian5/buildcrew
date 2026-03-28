import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { agents } from './agents';
import { users } from './users';
import { tasks } from './tasks';

export const chatThreads = pgTable(
  'chat_threads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    threadType: text('thread_type').notNull(), // 'goal_planning' | 'task_execution' | 'question' | 'report'
    relatedTaskId: uuid('related_task_id').references(() => tasks.id),
    status: text('status').default('active'), // 'active' | 'waiting_user' | 'waiting_agent' | 'closed'
    workflowState: text('workflow_state'), // 'planning' | 'hiring' | 'assigning' | 'checking' | 'completed' | null
    workflowRound: text('workflow_round').default('0'), // persisted round counter
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_chat_threads_company').on(table.companyId),
    index('idx_chat_threads_agent').on(table.agentId),
  ],
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => chatThreads.id, { onDelete: 'cascade' }),
    senderType: text('sender_type').notNull(), // 'user' | 'agent' | 'system'
    senderAgentId: uuid('sender_agent_id').references(() => agents.id),
    content: text('content').notNull(),
    messageType: text('message_type').default('text'), // 'text' | 'plan' | 'question' | 'approval_request' | 'result' | 'code'
    metadata: jsonb('metadata').default({}),
    tokenUsage: jsonb('token_usage'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_chat_messages_thread').on(table.threadId)],
);

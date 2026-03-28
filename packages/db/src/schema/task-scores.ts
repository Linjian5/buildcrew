import { pgTable, uuid, real, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { tasks } from './tasks';
import { agents } from './agents';

export const taskScores = pgTable(
  'task_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id').references(() => agents.id),
    correctness: real('correctness').notNull(),
    codeQuality: real('code_quality').notNull(),
    efficiency: real('efficiency').notNull(),
    costEfficiency: real('cost_efficiency').notNull(),
    overall: real('overall').notNull(),
    reviewPassedFirstTry: boolean('review_passed_first_try').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_task_scores_task').on(table.taskId),
    index('idx_task_scores_agent').on(table.agentId),
  ],
);

import { pgTable, uuid, text, decimal, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { agents } from './agents';

export const agentProfiles = pgTable(
  'agent_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' })
      .unique(),
    specialties: jsonb('specialties').default([]).$type<string[]>(),
    modelTier: text('model_tier').default('standard'),
    avgTaskDurationMs: integer('avg_task_duration_ms').default(0),
    successRate: decimal('success_rate', { precision: 5, scale: 4 }).default('0'),
    costPerTaskAvg: decimal('cost_per_task_avg', { precision: 10, scale: 4 }).default('0'),
    currentQueueDepth: integer('current_queue_depth').default(0),
    tasksCompleted: integer('tasks_completed').default(0),
    totalScore: decimal('total_score', { precision: 7, scale: 2 }).default('0'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_agent_profiles_agent').on(table.agentId)],
);

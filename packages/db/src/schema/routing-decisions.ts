import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { tasks } from './tasks';
import { agents } from './agents';

export const routingDecisions = pgTable(
  'routing_decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    candidates: jsonb('candidates').notNull().$type<CandidateScore[]>(),
    strategy: text('strategy').notNull(),
    selectedAgentId: uuid('selected_agent_id').references(() => agents.id),
    reasoning: text('reasoning'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_routing_decisions_company').on(table.companyId),
    index('idx_routing_decisions_task').on(table.taskId),
  ],
);

export interface CandidateScore {
  agent_id: string;
  agent_name: string;
  score: number;
  factors: {
    cost: number;
    quality: number;
    speed: number;
    availability: number;
  };
}

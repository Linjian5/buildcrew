import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { agents } from './agents';
import { companies } from './companies';

export const agentLoans = pgTable(
  'agent_loans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id),
    fromCompanyId: uuid('from_company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    toCompanyId: uuid('to_company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    durationHours: integer('duration_hours').notNull(),
    status: text('status').default('active'), // 'active' | 'completed' | 'cancelled'
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_agent_loans_agent').on(table.agentId),
    index('idx_agent_loans_to').on(table.toCompanyId),
  ],
);

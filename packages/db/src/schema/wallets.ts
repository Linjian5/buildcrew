import { pgTable, uuid, text, decimal, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const userWallets = pgTable(
  'user_wallets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    balance: decimal('balance', { precision: 10, scale: 4 }).notNull().default('0'),
    currency: text('currency').notNull().default('USD'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_user_wallets_user').on(table.userId)],
);

export const walletTransactions = pgTable(
  'wallet_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    walletId: uuid('wallet_id')
      .notNull()
      .references(() => userWallets.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'topup' | 'consume' | 'refund'
    amount: decimal('amount', { precision: 10, scale: 4 }).notNull(),
    description: text('description'),
    referenceId: text('reference_id'), // usage_record ID or external payment ID
    balanceAfter: decimal('balance_after', { precision: 10, scale: 4 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_wallet_transactions_wallet').on(table.walletId),
    index('idx_wallet_transactions_type').on(table.type),
  ],
);

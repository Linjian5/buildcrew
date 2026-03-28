import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const modelApiKeys = pgTable(
  'model_api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'anthropic' | 'openai' | 'deepseek' | 'zhipu' | 'moonshot' | 'custom'
    displayName: text('display_name').notNull(),
    apiKeyEncrypted: text('api_key_encrypted').notNull(), // AES-256-GCM
    apiEndpoint: text('api_endpoint'),
    isDefault: boolean('is_default').default(false),
    isValid: boolean('is_valid').default(true),
    lastValidatedAt: timestamp('last_validated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_model_api_keys_user').on(table.userId),
    index('idx_model_api_keys_provider').on(table.userId, table.provider),
  ],
);

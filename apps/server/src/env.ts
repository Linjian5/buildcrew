import dotenv from 'dotenv';
import { resolve } from 'path';
import { z } from 'zod';

// Load .env from the server directory
dotenv.config({ path: resolve(import.meta.dirname ?? '.', '..', '.env') });

const envSchema = z.object({
  DATABASE_URL: z.string().default('postgresql://localhost:5432/buildcrew'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  PORT: z.coerce.number().default(3100),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().default('buildcrew-dev-secret'),
  ENCRYPTION_KEY: z.string().default('0'.repeat(64)),
  PLATFORM_AI_KEY: z.string().default(''),
  PLATFORM_AI_PROVIDER: z.string().default('deepseek'),
  PLATFORM_AI_MODEL: z.string().default('deepseek-chat'),
  PLATFORM_AI_ENDPOINT: z.string().default('https://api.deepseek.com/v1'),
  // B-06: Wallet & billing
  INITIAL_BALANCE: z.coerce.number().default(1.00), // $1.00 initial credit for new users
  // Model pricing ($/1K tokens) — override in .env
  PRICE_DEEPSEEK_CHAT: z.coerce.number().default(0.001),
  PRICE_GPT4O: z.coerce.number().default(0.01),
  PRICE_CLAUDE_SONNET: z.coerce.number().default(0.015),
});

export const env = envSchema.parse(process.env);

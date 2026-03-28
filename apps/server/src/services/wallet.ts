import { eq, desc, and, sql } from '@buildcrew/db';
import { db, userWallets, walletTransactions } from '@buildcrew/db';
import { env } from '../env.js';

// ============================================================
//  B-06: Wallet & Billing Service
// ============================================================

// --- Model pricing ($/1K tokens) ---
const MODEL_PRICES: Record<string, number> = {
  'deepseek-chat': env.PRICE_DEEPSEEK_CHAT,
  'deepseek-coder': env.PRICE_DEEPSEEK_CHAT,
  'gpt-4o': env.PRICE_GPT4O,
  'gpt-4o-mini': env.PRICE_GPT4O * 0.3,
  'claude-sonnet-4-20250514': env.PRICE_CLAUDE_SONNET,
  'claude-sonnet-4': env.PRICE_CLAUDE_SONNET,
  'claude-haiku-4-5-20251001': env.PRICE_CLAUDE_SONNET * 0.3,
};

/**
 * Get the price per 1K tokens for a model.
 */
export function getModelPrice(model: string): number {
  return MODEL_PRICES[model] ?? env.PRICE_DEEPSEEK_CHAT; // Default to cheapest
}

/**
 * Calculate cost for a given token count.
 */
export function calculateCost(model: string, totalTokens: number): number {
  const pricePerK = getModelPrice(model);
  return (totalTokens / 1000) * pricePerK;
}

/**
 * Ensure a wallet exists for the user. Creates one with initial balance if not.
 */
export async function ensureWallet(userId: string): Promise<typeof userWallets.$inferSelect> {
  const [existing] = await db.select().from(userWallets).where(eq(userWallets.userId, userId));
  if (existing) return existing;

  const [wallet] = await db.insert(userWallets).values({
    userId,
    balance: String(env.INITIAL_BALANCE),
    currency: 'USD',
  }).returning();

  // Record initial balance as topup transaction
  if (wallet && env.INITIAL_BALANCE > 0) {
    await db.insert(walletTransactions).values({
      walletId: wallet.id,
      type: 'topup',
      amount: String(env.INITIAL_BALANCE),
      description: 'Welcome bonus',
      balanceAfter: String(env.INITIAL_BALANCE),
    });
  }

  return wallet!;
}

/**
 * Get wallet balance for a user.
 */
export async function getBalance(userId: string): Promise<{ balance: number; currency: string; walletId: string }> {
  const wallet = await ensureWallet(userId);
  return {
    balance: Number(wallet.balance),
    currency: wallet.currency,
    walletId: wallet.id,
  };
}

/**
 * Check if user has sufficient balance for an estimated cost.
 * Returns true if balance >= cost, false otherwise.
 */
export async function checkBalance(userId: string, estimatedCost: number): Promise<boolean> {
  const { balance } = await getBalance(userId);
  return balance >= estimatedCost;
}

/**
 * Deduct cost from wallet after AI call. Uses SELECT FOR UPDATE for atomicity.
 * Returns the transaction record, or null if insufficient balance.
 */
export async function deductCost(params: {
  userId: string;
  model: string;
  totalTokens: number;
  description: string;
  referenceId?: string;
}): Promise<{ cost: number; balanceAfter: number } | null> {
  const cost = calculateCost(params.model, params.totalTokens);
  if (cost <= 0) return { cost: 0, balanceAfter: 0 };

  return await db.transaction(async (tx) => {
    // SELECT FOR UPDATE — lock the wallet row
    const rows = await tx.execute(
      sql`SELECT id, balance FROM user_wallets WHERE user_id = ${params.userId} FOR UPDATE`,
    );
    const wallet = (rows as unknown as Array<{ id: string; balance: string }>)[0];
    if (!wallet) return null;

    const currentBalance = Number(wallet.balance);
    if (currentBalance < cost) return null; // Insufficient

    const newBalance = Math.round((currentBalance - cost) * 10000) / 10000;

    // Update balance
    await tx.execute(
      sql`UPDATE user_wallets SET balance = ${String(newBalance)}, updated_at = NOW() WHERE id = ${wallet.id}`,
    );

    // Record transaction
    await tx.insert(walletTransactions).values({
      walletId: wallet.id,
      type: 'consume',
      amount: String(-cost),
      description: params.description,
      referenceId: params.referenceId,
      balanceAfter: String(newBalance),
    });

    return { cost, balanceAfter: newBalance };
  });
}

/**
 * Add funds to wallet (topup).
 */
export async function topup(params: {
  userId: string;
  amount: number;
  description?: string;
  referenceId?: string;
}): Promise<{ balance: number }> {
  const wallet = await ensureWallet(params.userId);

  const currentBalance = Number(wallet.balance);
  const newBalance = Math.round((currentBalance + params.amount) * 10000) / 10000;

  await db.update(userWallets).set({
    balance: String(newBalance),
    updatedAt: new Date(),
  }).where(eq(userWallets.id, wallet.id));

  await db.insert(walletTransactions).values({
    walletId: wallet.id,
    type: 'topup',
    amount: String(params.amount),
    description: params.description ?? 'Manual topup',
    referenceId: params.referenceId,
    balanceAfter: String(newBalance),
  });

  return { balance: newBalance };
}

/**
 * Get transaction history for a user's wallet.
 */
export async function getTransactions(params: {
  userId: string;
  type?: 'topup' | 'consume' | 'refund';
  page: number;
  limit: number;
}): Promise<{ items: Array<typeof walletTransactions.$inferSelect>; total: number }> {
  const wallet = await ensureWallet(params.userId);
  const offset = (params.page - 1) * params.limit;

  const conditions = [eq(walletTransactions.walletId, wallet.id)];
  if (params.type) conditions.push(eq(walletTransactions.type, params.type));

  const where = and(...conditions);

  const [items, countResult] = await Promise.all([
    db.select().from(walletTransactions)
      .where(where)
      .orderBy(desc(walletTransactions.createdAt))
      .limit(params.limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(walletTransactions).where(where),
  ]);

  return {
    items,
    total: Number(countResult[0]?.count ?? 0),
  };
}

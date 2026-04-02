import { eq, and } from '@buildcrew/db';
import { db, modelApiKeys, usageRecords } from '@buildcrew/db';
import { decrypt } from '../lib/encryption.js';
import { getProviderEndpoint, estimateCost } from '../lib/providers.js';
import { emitEvent } from '../ws.js';
import { env } from '../env.js';
import { ensureWallet, deductCost, checkBalance } from './wallet.js';
import { getMockAIResponse } from './ai-mock.js';

// Platform key from env — NEVER exposed in logs, responses, or frontend
const PLATFORM_KEY = env.PLATFORM_AI_KEY;
const PLATFORM_PROVIDER = env.PLATFORM_AI_PROVIDER;
const PLATFORM_MODEL = env.PLATFORM_AI_MODEL;
const PLATFORM_ENDPOINT = env.PLATFORM_AI_ENDPOINT;

export interface AICallParams {
  userId: string;
  agentId: string;
  companyId: string;
  provider: string;
  model: string;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  taskId?: string;
  requestType?: string;
  /** Allow falling back to platform key for onboarding / free users */
  allowPlatformKey?: boolean;
  /** Override max_tokens (default 4096). Use 800 for onboarding to save cost + speed. */
  maxTokens?: number;
}

export interface AICallResult {
  content: string;
  tokenUsage: { prompt: number; completion: number; total: number; cost: number };
  source: 'user_key' | 'platform_key';
}

/**
 * B-06: Unified AI call — platform key + wallet billing.
 * 1. Ensure wallet exists
 * 2. Check balance (rough estimate)
 * 3. Call AI with platform key
 * 4. Deduct actual cost from wallet
 * Falls back to user's own key if platform key unavailable.
 */
export async function callAI(params: AICallParams): Promise<AICallResult> {
  // Mock mode for E2E tests — deterministic, no real AI calls
  if (env.MOCK_AI === 'true') {
    return getMockAIResponse(params.messages, params.systemPrompt);
  }

  // Ensure wallet exists for user
  await ensureWallet(params.userId);

  // Check balance before calling (rough estimate: 1K tokens)
  const hasBalance = await checkBalance(params.userId, 0.001);
  if (!hasBalance) {
    throw new AIError('INSUFFICIENT_BALANCE', 'Wallet balance is 0. Please top up to continue.');
  }

  // Determine which key to use
  let result: AICallResult;

  if (PLATFORM_KEY) {
    // Primary path: use platform key
    const aiResult = await callWithRawKey(
      { ...params, provider: PLATFORM_PROVIDER, model: PLATFORM_MODEL },
      PLATFORM_KEY,
      PLATFORM_ENDPOINT,
    );
    result = { ...aiResult, source: 'platform_key' };
  } else {
    // Fallback: try user's own key
    const userKey = await findUserKey(params.userId, params.provider);
    if (!userKey) {
      throw new AIError('NO_API_KEY', 'Platform key not configured and no user key found.');
    }
    const aiResult = await callWithUserKey(params, userKey);
    result = { ...aiResult, source: 'user_key' };
  }

  // Deduct cost from wallet
  const model = PLATFORM_KEY ? PLATFORM_MODEL : params.model;
  const deduction = await deductCost({
    userId: params.userId,
    model,
    totalTokens: result.tokenUsage.total,
    description: `AI call: ${params.requestType ?? 'chat'} (${model})`,
  });

  if (!deduction) {
    // Cost deduction failed (race condition — balance drained)
    // Don't throw — the AI call already succeeded, just log
    console.warn(`[Wallet] Deduction failed for user ${params.userId}, cost would have been for ${result.tokenUsage.total} tokens`);
  }

  // Record in usage_records (keep existing tracking)
  await db
    .insert(usageRecords)
    .values({
      userId: params.userId,
      companyId: params.companyId,
      agentId: params.agentId,
      taskId: params.taskId,
      provider: PLATFORM_KEY ? PLATFORM_PROVIDER : params.provider,
      model,
      promptTokens: result.tokenUsage.prompt,
      completionTokens: result.tokenUsage.completion,
      totalTokens: result.tokenUsage.total,
      costUsd: String(deduction?.cost ?? result.tokenUsage.cost),
      requestType: params.requestType ?? 'chat',
    })
    .catch(() => {});

  return result;
}

// --- Internal helpers ---

async function findUserKey(userId: string, provider: string) {
  // Try default key for this provider
  const [defaultKey] = await db
    .select()
    .from(modelApiKeys)
    .where(
      and(
        eq(modelApiKeys.userId, userId),
        eq(modelApiKeys.provider, provider),
        eq(modelApiKeys.isDefault, true),
      ),
    );
  if (defaultKey) return defaultKey;

  // Try any key for this provider
  const [anyKey] = await db
    .select()
    .from(modelApiKeys)
    .where(and(eq(modelApiKeys.userId, userId), eq(modelApiKeys.provider, provider)));
  return anyKey ?? null;
}

async function callWithUserKey(
  params: AICallParams,
  keyRow: typeof modelApiKeys.$inferSelect,
): Promise<Omit<AICallResult, 'source'>> {
  let apiKey: string;
  try {
    apiKey = decrypt(keyRow.apiKeyEncrypted);
  } catch {
    await markKeyInvalid(keyRow.id);
    throw new AIError('KEY_DECRYPT_FAILED', 'Failed to decrypt API key');
  }

  const endpoint = getProviderEndpoint(keyRow.provider, keyRow.apiEndpoint);
  if (!endpoint) throw new AIError('NO_ENDPOINT', `No endpoint for provider: ${keyRow.provider}`);

  const result = await doCall(endpoint, apiKey, { ...params, provider: keyRow.provider }, keyRow.id);

  // Record usage
  await db
    .insert(usageRecords)
    .values({
      userId: params.userId,
      companyId: params.companyId,
      agentId: params.agentId,
      taskId: params.taskId,
      modelKeyId: keyRow.id,
      provider: keyRow.provider,
      model: params.model,
      promptTokens: result.tokenUsage.prompt,
      completionTokens: result.tokenUsage.completion,
      totalTokens: result.tokenUsage.total,
      costUsd: String(result.tokenUsage.cost),
      requestType: params.requestType ?? 'task_execution',
    })
    .catch(() => {});

  return result;
}

async function callWithRawKey(
  params: AICallParams,
  apiKey: string,
  endpoint: string,
): Promise<Omit<AICallResult, 'source'>> {
  return doCall(endpoint, apiKey, params, null);
}

async function doCall(
  endpoint: string,
  apiKey: string,
  params: AICallParams,
  keyId: string | null,
): Promise<Omit<AICallResult, 'source'>> {
  try {
    if (params.provider === 'anthropic') {
      return await callAnthropic(endpoint, apiKey, params);
    } else {
      return await callOpenAICompatible(endpoint, apiKey, params);
    }
  } catch (e) {
    if (e instanceof AIError) throw e;
    const msg = e instanceof Error ? e.message : String(e);

    if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized')) {
      if (keyId) {
        await markKeyInvalid(keyId);
        emitEvent(params.companyId, 'alert.created', {
          severity: 'warning',
          category: 'security',
          description: `API key for ${params.provider} is invalid`,
          agent_id: params.agentId,
        });
      }
      throw new AIError('KEY_INVALID', `API key is invalid for ${params.provider}`);
    }

    if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('abort')) {
      // Retry once
      try {
        if (params.provider === 'anthropic') {
          return await callAnthropic(endpoint, apiKey, params);
        } else {
          return await callOpenAICompatible(endpoint, apiKey, params);
        }
      } catch {
        throw new AIError('MODEL_TIMEOUT', `Model call timed out after retry`);
      }
    }

    throw new AIError('MODEL_ERROR', `Model call failed: ${msg}`);
  }
}

function getDefaultModel(provider: string): string {
  const defaults: Record<string, string> = {
    anthropic: 'claude-sonnet-4',
    openai: 'gpt-4o',
    deepseek: 'deepseek-chat',
    zhipu: 'glm-4-flash',
    moonshot: 'moonshot-v1-8k',
    minimax: 'abab6.5-chat',
    qwen: 'qwen-plus',
  };
  return defaults[provider] ?? 'default';
}

// --- Provider-specific calls ---

async function callAnthropic(endpoint: string, apiKey: string, params: AICallParams): Promise<Omit<AICallResult, 'source'>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(`${endpoint}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens ?? 4096,
        system: params.systemPrompt,
        messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      content: Array<{ text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    const content = data.content.map((c) => c.text).join('');
    const prompt = data.usage.input_tokens;
    const completion = data.usage.output_tokens;
    const total = prompt + completion;
    const cost = estimateCost(params.provider, params.model, total);

    return { content, tokenUsage: { prompt, completion, total, cost } };
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAICompatible(endpoint: string, apiKey: string, params: AICallParams): Promise<Omit<AICallResult, 'source'>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const messages = [
      { role: 'system' as const, content: params.systemPrompt },
      ...params.messages,
    ];

    const res = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: params.model,
        messages,
        max_tokens: params.maxTokens ?? 4096,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const content = data.choices[0]?.message.content ?? '';
    const prompt = data.usage?.prompt_tokens ?? 0;
    const completion = data.usage?.completion_tokens ?? 0;
    const total = data.usage?.total_tokens ?? prompt + completion;
    const cost = estimateCost(params.provider, params.model, total);

    return { content, tokenUsage: { prompt, completion, total, cost } };
  } finally {
    clearTimeout(timeout);
  }
}

// --- Streaming ---

export interface StreamChunk {
  type: 'delta' | 'done' | 'error';
  content?: string;
  tokenUsage?: { prompt: number; completion: number; total: number; cost: number };
  source?: 'user_key' | 'platform_key';
  error?: string;
}

/**
 * Stream AI response. Resolves the same key priority chain as callAI,
 * then yields chunks as the model generates them.
 */
export async function* callAIStream(params: AICallParams): AsyncGenerator<StreamChunk> {
  // Mock mode for E2E tests
  if (env.MOCK_AI === 'true') {
    const mock = getMockAIResponse(params.messages, params.systemPrompt);
    yield { type: 'delta', content: mock.content };
    yield { type: 'done', content: mock.content, tokenUsage: mock.tokenUsage, source: mock.source };
    return;
  }

  // Resolve key (same logic as callAI)
  let apiKey: string;
  let endpoint: string;
  let provider: string;
  let model: string;
  let source: 'user_key' | 'platform_key';
  let keyId: string | null = null;

  const userKey = await findUserKey(params.userId, params.provider);
  if (userKey) {
    try { apiKey = decrypt(userKey.apiKeyEncrypted); } catch { throw new AIError('KEY_DECRYPT_FAILED', 'Failed to decrypt'); }
    endpoint = getProviderEndpoint(userKey.provider, userKey.apiEndpoint);
    provider = userKey.provider;
    model = params.model;
    source = 'user_key';
    keyId = userKey.id;
  } else {
    const [anyKey] = await db.select().from(modelApiKeys).where(eq(modelApiKeys.userId, params.userId)).limit(1);
    if (anyKey) {
      try { apiKey = decrypt(anyKey.apiKeyEncrypted); } catch { throw new AIError('KEY_DECRYPT_FAILED', 'Failed to decrypt'); }
      endpoint = getProviderEndpoint(anyKey.provider, anyKey.apiEndpoint);
      provider = anyKey.provider;
      model = getDefaultModel(anyKey.provider);
      source = 'user_key';
      keyId = anyKey.id;
    } else if (params.allowPlatformKey !== false && PLATFORM_KEY) {
      apiKey = PLATFORM_KEY;
      endpoint = PLATFORM_ENDPOINT;
      provider = PLATFORM_PROVIDER;
      model = PLATFORM_MODEL;
      source = 'platform_key';
    } else {
      throw new AIError('NO_API_KEY', 'No API key configured');
    }
  }

  if (!endpoint) throw new AIError('NO_ENDPOINT', 'No endpoint');

  // Build messages array (OpenAI compatible format for streaming)
  const messages = [
    { role: 'system' as const, content: params.systemPrompt },
    ...params.messages,
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: params.maxTokens ?? 4096,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      yield { type: 'error', error: `${res.status}: ${text}` };
      return;
    }

    if (!res.body) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    let fullContent = '';
    let lastUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
            usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
          };

          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            yield { type: 'delta', content: delta };
          }
          if (parsed.usage) lastUsage = parsed.usage;
        } catch {
          // skip malformed chunks
        }
      }
    }

    // Estimate tokens if server didn't send usage
    const promptTokens = lastUsage?.prompt_tokens ?? Math.ceil(params.systemPrompt.length / 4);
    const completionTokens = lastUsage?.completion_tokens ?? Math.ceil(fullContent.length / 4);
    const totalTokens = lastUsage?.total_tokens ?? promptTokens + completionTokens;
    const cost = estimateCost(provider, model, totalTokens);

    const tokenUsage = { prompt: promptTokens, completion: completionTokens, total: totalTokens, cost };

    // Record usage
    await db
      .insert(usageRecords)
      .values({
        userId: params.userId,
        companyId: params.companyId,
        agentId: params.agentId,
        taskId: params.taskId,
        modelKeyId: keyId,
        provider, model,
        promptTokens, completionTokens, totalTokens,
        costUsd: String(cost),
        requestType: source === 'platform_key' ? 'platform_onboarding' : (params.requestType ?? 'chat'),
      })
      .catch(() => {});

    yield { type: 'done', tokenUsage, source, content: fullContent };
  } finally {
    clearTimeout(timeout);
  }
}

// --- Helpers ---

async function markKeyInvalid(keyId: string) {
  await db
    .update(modelApiKeys)
    .set({ isValid: false, updatedAt: new Date() })
    .where(eq(modelApiKeys.id, keyId))
    .catch(() => {});
}

export class AIError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'AIError';
  }
}

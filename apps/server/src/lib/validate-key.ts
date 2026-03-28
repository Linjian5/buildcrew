import { getProviderEndpoint } from './providers.js';

interface ValidateResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate an API key by making a minimal request to the provider.
 * Sends "hi" with max_tokens:1 — cheapest possible check.
 */
export async function validateApiKey(
  provider: string,
  apiKey: string,
  customEndpoint?: string | null,
): Promise<ValidateResult> {
  const endpoint = getProviderEndpoint(provider, customEndpoint);
  if (!endpoint) return { valid: false, error: 'No endpoint configured' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    if (provider === 'anthropic') {
      return await validateAnthropic(endpoint, apiKey, controller.signal);
    } else {
      return await validateOpenAICompatible(endpoint, apiKey, provider, controller.signal);
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return { valid: false, error: 'timeout' };
    }
    return { valid: false, error: e instanceof Error ? e.message : 'Unknown error' };
  } finally {
    clearTimeout(timeout);
  }
}

async function validateAnthropic(endpoint: string, apiKey: string, signal: AbortSignal): Promise<ValidateResult> {
  const res = await fetch(`${endpoint}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }),
    signal,
  });

  if (res.ok) return { valid: true };
  if (res.status === 401 || res.status === 403) {
    return { valid: false, error: 'Invalid API key (authentication failed)' };
  }
  // 4xx/5xx but not auth — key may be valid but quota/other issue
  const text = await res.text().catch(() => '');
  if (res.status === 429) return { valid: true }; // rate limited = key is valid
  return { valid: false, error: `API returned ${res.status}: ${text.slice(0, 200)}` };
}

async function validateOpenAICompatible(
  endpoint: string,
  apiKey: string,
  provider: string,
  signal: AbortSignal,
): Promise<ValidateResult> {
  // Pick the cheapest model for each provider
  const testModel: Record<string, string> = {
    openai: 'gpt-4o-mini',
    deepseek: 'deepseek-chat',
    zhipu: 'glm-4-flash',
    moonshot: 'moonshot-v1-8k',
    minimax: 'abab5.5-chat',
    qwen: 'qwen-turbo',
  };
  const model = testModel[provider] ?? 'default';

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 1,
    }),
    signal,
  });

  if (res.ok) return { valid: true };
  if (res.status === 401 || res.status === 403) {
    return { valid: false, error: 'Invalid API key (authentication failed)' };
  }
  if (res.status === 429) return { valid: true }; // rate limited = key is valid
  const text = await res.text().catch(() => '');
  return { valid: false, error: `API returned ${res.status}: ${text.slice(0, 200)}` };
}

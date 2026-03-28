export interface ProviderConfig {
  name: string;
  endpoint: string;
  models: string[];
  keyPrefix: string;
  costPer1kTokens: Record<string, number>;
}

export const MODEL_PROVIDERS: Record<string, ProviderConfig> = {
  anthropic: {
    name: 'Anthropic (Claude)',
    endpoint: 'https://api.anthropic.com/v1',
    models: ['claude-opus-4', 'claude-sonnet-4', 'claude-haiku-4'],
    keyPrefix: 'sk-ant-',
    costPer1kTokens: { 'claude-opus-4': 0.015, 'claude-sonnet-4': 0.003, 'claude-haiku-4': 0.00025 },
  },
  openai: {
    name: 'OpenAI (GPT)',
    endpoint: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1'],
    keyPrefix: 'sk-',
    costPer1kTokens: { 'gpt-4o': 0.005, 'gpt-4o-mini': 0.00015, 'o1': 0.015 },
  },
  deepseek: {
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-coder'],
    keyPrefix: 'sk-',
    costPer1kTokens: { 'deepseek-chat': 0.001, 'deepseek-coder': 0.0005 },
  },
  zhipu: {
    name: '智谱 AI (GLM)',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-plus', 'glm-4-flash'],
    keyPrefix: '',
    costPer1kTokens: { 'glm-4-plus': 0.01, 'glm-4-flash': 0.0001 },
  },
  moonshot: {
    name: '月之暗面 (Kimi)',
    endpoint: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-128k'],
    keyPrefix: 'sk-',
    costPer1kTokens: { 'moonshot-v1-8k': 0.002, 'moonshot-v1-128k': 0.006 },
  },
  minimax: {
    name: 'MiniMax',
    endpoint: 'https://api.minimax.chat/v1',
    models: ['abab6.5-chat', 'abab5.5-chat'],
    keyPrefix: '',
    costPer1kTokens: { 'abab6.5-chat': 0.003, 'abab5.5-chat': 0.001 },
  },
  qwen: {
    name: '通义千问 (Qwen)',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
    keyPrefix: 'sk-',
    costPer1kTokens: { 'qwen-max': 0.004, 'qwen-plus': 0.002, 'qwen-turbo': 0.0005 },
  },
  custom: {
    name: 'Custom (OpenAI Compatible)',
    endpoint: '',
    models: [],
    keyPrefix: '',
    costPer1kTokens: {},
  },
};

export function getProviderEndpoint(provider: string, customEndpoint?: string | null): string {
  if (customEndpoint) return customEndpoint;
  return MODEL_PROVIDERS[provider]?.endpoint ?? '';
}

export function estimateCost(provider: string, model: string, totalTokens: number): number {
  const costPer1k = MODEL_PROVIDERS[provider]?.costPer1kTokens[model] ?? 0.001;
  return (totalTokens / 1000) * costPer1k;
}

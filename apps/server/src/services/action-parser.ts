import { z } from 'zod';
import { callAI } from './ai-client.js';
import { emitEvent } from '../ws.js';

// --- Zod schemas for CEO action JSON ---

const hireActionSchema = z.object({
  type: z.literal('hire_agent'),
  name: z.string().min(1),
  title: z.string().optional(),
  department: z.string().optional(),
});

const fireActionSchema = z.object({
  type: z.literal('fire_agent'),
  name: z.string().min(1),
});

const actionItemSchema = z.discriminatedUnion('type', [hireActionSchema, fireActionSchema]);

const teamMemberSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  department: z.string().optional(),
});

const actionsPayloadSchema = z.object({
  actions: z.array(actionItemSchema).min(1),
});

const teamPayloadSchema = z.object({
  team: z.array(teamMemberSchema).min(1),
});

const planTaskSchema = z.object({
  title: z.string().min(1),
  assignTo: z.string().optional(),
  estimatedCost: z.number().optional(),
  priority: z.string().optional(),
});

const planPhaseSchema = z.object({
  name: z.string().min(1),
  tasks: z.array(planTaskSchema).min(1),
});

const planPayloadSchema = z.object({
  plan: z.object({
    phases: z.array(planPhaseSchema).min(1),
    team: z.array(teamMemberSchema).optional(),
    totalEstimatedCost: z.number().optional(),
    estimatedDuration: z.string().optional(),
    budget: z.object({
      perAgent: z.record(z.string(), z.number()).optional(),
      total: z.number().optional(),
    }).optional(),
  }),
});

// plan_confirmation — display-only, frontend renders confirm/adjust buttons
const planConfirmationTaskSchema = z.object({
  assignee: z.string().optional(),
  title: z.string().min(1),
  estimated_cost: z.string().optional(),
});

const planConfirmationSchema = z.object({
  action: z.literal('plan_confirmation'),
  plan: z.object({
    goals: z.array(z.string()).optional(),
    tasks: z.array(planConfirmationTaskSchema).optional(),
    total_estimated_cost: z.string().optional(),
    billing_note: z.string().optional(),
  }),
});

export type PlanConfirmationPayload = z.infer<typeof planConfirmationSchema>;

// Union of all valid CEO action payloads
const ceoActionSchema = z.union([actionsPayloadSchema, teamPayloadSchema, planPayloadSchema, planConfirmationSchema]);

export type CEOActionPayload = z.infer<typeof ceoActionSchema>;

export interface ActionParseResult {
  /** Clean text without JSON blocks */
  displayText: string;
  /** Validated structured data, or null if none found */
  structuredData: CEOActionPayload | null;
  /** Raw parsed JSON before validation (for logging) */
  rawParsed: unknown | null;
  /** Validation errors if JSON was found but invalid */
  validationErrors: string[] | null;
}

/**
 * Multi-layer JSON extraction from CEO response.
 * Strategy:
 *   1. Extract ```json code blocks
 *   2. Regex match {"action*": ...} / {"team": ...} / {"plan": ...} structures
 *   3. Full JSON.parse of entire content
 *   4. Return null if all fail
 */
export function extractAndValidateAction(content: string): ActionParseResult {
  let displayText = content;

  // --- Layer 1: ```json code blocks ---
  const jsonBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/g;
  const matches = [...content.matchAll(jsonBlockRegex)];
  for (const match of matches) {
    const result = tryParseAndValidate(match[1] ?? '');
    if (result.structuredData) {
      displayText = displayText.replace(match[0], '').trim();
      return { ...result, displayText };
    }
    if (result.rawParsed) {
      // JSON parsed but failed validation — still useful info
      displayText = displayText.replace(match[0], '').trim();
      return { ...result, displayText };
    }
  }

  // --- Layer 2: Regex match inline JSON objects ---
  const inlinePatterns = [
    /\{[\s\S]*?"action"\s*:\s*"plan_confirmation"[\s\S]*?\}\s*\}/,
    /\{[\s\S]*?"actions"\s*:\s*\[[\s\S]*?\]\s*\}/,
    /\{[\s\S]*?"team"\s*:\s*\[[\s\S]*?\]\s*\}/,
    /\{[\s\S]*?"plan"\s*:\s*\{[\s\S]*?\}\s*\}/,
  ];
  for (const pattern of inlinePatterns) {
    const inlineMatch = content.match(pattern);
    if (inlineMatch) {
      const result = tryParseAndValidate(inlineMatch[0]);
      if (result.structuredData) {
        displayText = displayText.replace(inlineMatch[0], '').trim();
        return { ...result, displayText };
      }
      if (result.rawParsed) {
        displayText = displayText.replace(inlineMatch[0], '').trim();
        return { ...result, displayText };
      }
    }
  }

  // --- Layer 3: Try full content as JSON ---
  const trimmed = content.trim();
  if (trimmed.startsWith('{')) {
    const result = tryParseAndValidate(trimmed);
    if (result.structuredData) {
      return { ...result, displayText: '' };
    }
    if (result.rawParsed) {
      return { ...result, displayText: trimmed };
    }
  }

  // --- Layer 4: No JSON found ---
  return { displayText, structuredData: null, rawParsed: null, validationErrors: null };
}

function tryParseAndValidate(jsonStr: string): Omit<ActionParseResult, 'displayText'> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return { structuredData: null, rawParsed: null, validationErrors: null };
  }

  const validation = ceoActionSchema.safeParse(parsed);
  if (validation.success) {
    return { structuredData: validation.data, rawParsed: parsed, validationErrors: null };
  }

  // Check if it's a recognizable structure with bad fields
  const obj = parsed as Record<string, unknown>;
  if (obj.actions || obj.team || obj.plan || obj.action) {
    const errors = validation.error.issues.map(
      (i) => `${i.path.join('.')}: ${i.message}`,
    );
    return { structuredData: null, rawParsed: parsed, validationErrors: errors };
  }

  return { structuredData: null, rawParsed: null, validationErrors: null };
}

// --- Role/action detection for retry trigger ---

const ROLE_NAMES = ['atlas', 'nova', 'echo', 'sentinel', 'vector', 'pixel', 'sage', 'scout', 'cipher'];
const ACTION_WORDS = [
  '招聘', '解雇', '移除', '加入', '请来', '入职', '去掉', '换掉', '新增',
  'hire', 'fire', 'remove', 'add', 'bring on', 'let go', 'replace',
  '创建', 'create', '组建', 'assemble', '团队', 'team',
];

/**
 * Detect if CEO mentioned team/task changes but didn't include action JSON.
 */
export function detectMissingActionJSON(content: string): boolean {
  const lower = content.toLowerCase();
  const mentionsRole = ROLE_NAMES.some((r) => lower.includes(r));
  const mentionsAction = ACTION_WORDS.some((w) => lower.includes(w));
  return mentionsRole && mentionsAction;
}

// --- Retry mechanism ---

export interface RetryContext {
  userId: string;
  agentId: string;
  companyId: string;
  provider: string;
  model: string;
  originalMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  originalSystemPrompt: string;
  maxRetries?: number;
}

export interface RetryResult {
  structuredData: CEOActionPayload | null;
  retryCount: number;
  finalError: string | null;
}

/**
 * Retry up to maxRetries times to get valid action JSON from CEO.
 * Each retry adds a system message asking CEO to re-output the action JSON.
 */
export async function retryForValidAction(
  ctx: RetryContext,
  failedContent: string,
): Promise<RetryResult> {
  const maxRetries = ctx.maxRetries ?? 2;
  let retryCount = 0;
  let lastError: string | null = null;

  for (let i = 0; i < maxRetries; i++) {
    retryCount++;
    try {
      const retryPrompt = i === 0
        ? 'You just promised to make changes but did not include the required action JSON. You MUST output a ```json code block with the action data. Output ONLY the JSON block now. Format: {"actions":[{"type":"hire_agent","name":"NAME","title":"TITLE","department":"DEPT"}]} or {"team":[{"name":"NAME"}]} or {"actions":[{"type":"fire_agent","name":"NAME"}]}'
        : 'CRITICAL: Your previous response was missing the action JSON. Without it, nothing happens. Output ONLY a valid JSON code block. No other text.';

      const messages = [
        ...ctx.originalMessages,
        { role: 'assistant' as const, content: failedContent },
        { role: 'user' as const, content: `[SYSTEM] ${retryPrompt}` },
      ];

      const result = await callAI({
        userId: ctx.userId,
        agentId: ctx.agentId,
        companyId: ctx.companyId,
        provider: ctx.provider,
        model: ctx.model,
        systemPrompt: ctx.originalSystemPrompt,
        messages,
        requestType: 'chat',
        allowPlatformKey: true,
        maxTokens: 300,
      });

      const parsed = extractAndValidateAction(result.content);
      if (parsed.structuredData) {
        return { structuredData: parsed.structuredData, retryCount, finalError: null };
      }

      lastError = parsed.validationErrors
        ? `Validation failed: ${parsed.validationErrors.join('; ')}`
        : 'No action JSON found in retry response';
      failedContent = result.content;
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Unknown retry error';
    }
  }

  return { structuredData: null, retryCount, finalError: lastError };
}

/**
 * Emit action_failed event and optionally mark thread for human review.
 */
export function emitActionFailed(
  companyId: string,
  details: {
    threadId: string;
    agentId: string;
    retryCount: number;
    error: string;
    originalContent: string;
  },
): void {
  emitEvent(companyId, 'agent.action_failed', {
    thread_id: details.threadId,
    agent_id: details.agentId,
    retry_count: details.retryCount,
    error: details.error,
    original_content: details.originalContent.slice(0, 500),
    needs_human_review: true,
    timestamp: new Date().toISOString(),
  });
}

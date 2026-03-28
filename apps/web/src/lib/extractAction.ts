export interface ActionData {
  type: string;
  [key: string]: unknown;
}

/**
 * Extract action from a chat message.
 * Priority: metadata.action_type (canonical backend source) > JSON in content (legacy).
 */
export function extractAction(text: string, metadata?: Record<string, unknown> | null): ActionData | null {
  // 1. Check metadata.action_type (canonical source from backend)
  if (metadata && typeof metadata.action_type === 'string') {
    return { type: metadata.action_type, ...metadata } as ActionData;
  }
  // 2. Fallback: parse JSON code block
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]!) as Record<string, unknown>;
      if (typeof parsed.type === 'string') return parsed as ActionData;
    } catch { /* ignore */ }
  }
  // 3. Fallback: inline JSON with "type"
  const inlineMatch = text.match(/\{"type"\s*:[\s\S]*?\}/);
  if (inlineMatch) {
    try {
      const parsed = JSON.parse(inlineMatch[0]) as Record<string, unknown>;
      if (typeof parsed.type === 'string') return parsed as ActionData;
    } catch { /* ignore */ }
  }
  return null;
}

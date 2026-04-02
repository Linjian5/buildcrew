/**
 * Deterministic AI responses for E2E testing.
 * Returns canned responses based on message context.
 */

import type { AICallResult } from './ai-client.js';

const MOCK_TOKEN_USAGE = { prompt: 100, completion: 200, total: 300, cost: 0.001 };

/**
 * Analyze messages and return appropriate canned response.
 * Follows the same Socratic one-question-at-a-time pattern as real Aria.
 */
export function getMockAIResponse(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string,
): AICallResult {
  const msgCount = messages.filter(m => m.role === 'user').length;

  // Onboarding conversation pattern: Aria asks one question at a time
  if (systemPrompt.includes('CEO') || systemPrompt.includes('Aria')) {
    return getAriaResponse(msgCount);
  }

  // Default response for other agents
  return {
    content: 'Task acknowledged. I will begin working on this right away.',
    tokenUsage: MOCK_TOKEN_USAGE,
    source: 'platform_key',
  };
}

function getAriaResponse(round: number): AICallResult {
  // Round-based responses simulating Socratic onboarding
  const responses: Record<number, string> = {
    0: "Welcome! I'm excited to help you build your company. Let me start by understanding your vision. What is the primary product or service your company will offer?",
    1: "Great choice! Now, who are your target customers? Understanding your audience will help me assemble the right team.",
    2: "Perfect. And what's your timeline for the initial launch? Are we looking at weeks or months?",
    3: "Excellent! I now have a clear picture. I have enough information to put together a solid plan for you. Shall I proceed with creating the team and execution plan?",
  };

  const content = responses[round] ?? responses[3]!;
  return { content, tokenUsage: MOCK_TOKEN_USAGE, source: 'platform_key' };
}

/**
 * Mock extracted context for confirm-plan API.
 * Always returns a complete plan with all three elements (team, plan, budget).
 */
export function getMockExtractedContext(language: string) {
  return {
    has_plan: true,
    has_team: true,
    has_budget: true,
    plan: {
      phases: [
        {
          name: language === 'zh' ? '第一阶段：产品开发' : language === 'ja' ? 'フェーズ1：製品開発' : 'Phase 1: Product Development',
          goals: [
            language === 'zh' ? '启动产品开发' : language === 'ja' ? '製品開発の開始' : 'Launch Product Development',
          ],
          tasks: [
            { title: 'Design system architecture', assignee: 'Atlas', priority: 'high', estimated_cost: 0.05 },
            { title: 'Build core API endpoints', assignee: 'Atlas', priority: 'high', estimated_cost: 0.08 },
            { title: 'Create frontend UI', assignee: 'Pixel', priority: 'high', estimated_cost: 0.06 },
            { title: 'Write integration tests', assignee: 'Echo', priority: 'medium', estimated_cost: 0.04 },
            { title: 'Deploy to staging', assignee: 'Atlas', priority: 'medium', estimated_cost: 0.03 },
          ],
        },
        {
          name: language === 'zh' ? '第二阶段：市场推广' : language === 'ja' ? 'フェーズ2：マーケティング' : 'Phase 2: Market Launch',
          goals: [
            language === 'zh' ? '建立市场推广' : language === 'ja' ? '市場プレゼンスの確立' : 'Establish Market Presence',
          ],
          tasks: [
            { title: 'Create landing page', assignee: 'Pixel', priority: 'high', estimated_cost: 0.04 },
            { title: 'Setup social media accounts', assignee: 'Scout', priority: 'medium', estimated_cost: 0.02 },
            { title: 'Write launch blog post', assignee: 'Scout', priority: 'medium', estimated_cost: 0.02 },
          ],
        },
      ],
    },
    team: [
      { name: 'Atlas', role: 'CTO', responsibility: 'Technical architecture and backend development' },
      { name: 'Pixel', role: 'UI/UX Designer', responsibility: 'Frontend design and user experience' },
      { name: 'Echo', role: 'QA Engineer', responsibility: 'Testing and quality assurance' },
      { name: 'Scout', role: 'Marketing Lead', responsibility: 'Marketing strategy and content' },
    ],
    budget: { total: 5000, breakdown: [
      { role: 'CTO', amount: 2000 },
      { role: 'UI/UX Designer', amount: 1200 },
      { role: 'QA Engineer', amount: 800 },
      { role: 'Marketing Lead', amount: 1000 },
    ] },
  };
}

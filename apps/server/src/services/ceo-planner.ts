import { eq } from '@buildcrew/db';
import { db, agents, companies, chatThreads, chatMessages, tasks } from '@buildcrew/db';
import { callAI, AIError } from './ai-client.js';
import { emitEvent } from '../ws.js';

type Language = 'en' | 'zh' | 'ja';

const LANGUAGE_INSTRUCTION: Record<Language, string> = {
  en: '',
  zh: '【语言要求】你必须全程使用简体中文回复。绝不使用英文，包括专有名词也用中文。',
  ja: '【言語要求】すべて日本語で回答してください。英語は一切使用しないでください。',
};

const CEO_NO_KEY: Record<Language, (name: string) => string> = {
  en: (n) => `⚠️ I'm ${n}, your CEO. I'm ready to create a plan for you, but I need an AI Model API Key first.\n\nPlease go to **Settings → Model API Keys** to add a key (Claude or GPT-4 recommended), then come back and tell me your goal — I'll start working immediately!`,
  zh: (n) => `⚠️ 我是 ${n}，你的 CEO。我已经准备好为你制定计划了，但需要先配置 AI 模型 API Key。\n\n请前往 **设置 → 模型 API Key** 添加一个 Key（推荐 Claude 或 GPT-4），然后回来告诉我你的目标，我会立即开始工作！`,
  ja: (n) => `⚠️ ${n}です、あなたのCEOです。計画を立てる準備はできていますが、まずAIモデルAPIキーの設定が必要です。\n\n**設定 → モデルAPIキー** でキーを追加してください（ClaudeまたはGPT-4推奨）。設定後、目標を教えてください！`,
};

export interface CEOPlanningContext {
  companyId: string;
  userId: string;
  goalDescription: string;
  language?: Language;
  /** Company template the user selected during onboarding */
  template?: 'saas' | 'ecommerce' | 'content' | 'design' | 'custom';
  /** Mission statement from onboarding */
  mission?: string;
  /** Industry from onboarding */
  industry?: string;
}

export async function triggerCEOPlanning(ctx: CEOPlanningContext) {
  const { companyId, userId, goalDescription, language = 'en' } = ctx;

  const ceo = await findCEOAgent(companyId);
  if (!ceo) return null;

  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  if (!company) return null;

  const team = await db.select().from(agents).where(eq(agents.companyId, companyId));
  const teamList = team.map((a) => `${a.name} — ${a.title} (${a.department})`).join('\n');

  const [thread] = await db
    .insert(chatThreads)
    .values({ companyId, agentId: ceo.id, userId, threadType: 'goal_planning', status: 'active' })
    .returning();
  if (!thread) return null;

  // Build the enhanced system prompt
  const template = ctx.template ?? company.template ?? detectTemplate(company.industry ?? '');
  const systemPrompt = buildCEOPrompt(ceo.name, company, teamList, template, language);

  const userMessage = goalDescription || company.mission || 'Help me get started';

  let ceoResponse: string;
  const runtime = ceo.runtimeConfig as { provider?: string; model?: string } | null;
  const provider = runtime?.provider ?? 'anthropic';
  const model = runtime?.model ?? 'claude-sonnet-4';

  try {
    const result = await callAI({
      userId, agentId: ceo.id, companyId, provider, model, systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      requestType: 'goal_planning',
      allowPlatformKey: true,
      maxTokens: 800,
    });
    ceoResponse = result.content;
  } catch (e) {
    if (e instanceof AIError && (e.code === 'NO_API_KEY' || e.code === 'DAILY_LIMIT')) {
      ceoResponse = CEO_NO_KEY[language](ceo.name);
    } else if (e instanceof AIError && e.code === 'KEY_INVALID') {
      const msg: Record<Language, (p: string) => string> = {
        en: (p) => `⚠️ Your ${p} API Key is invalid. Please check **Settings → Model API Keys**.`,
        zh: (p) => `⚠️ 你配置的 ${p} API Key 无效。请到 **设置 → 模型 API Key** 检查并更新。`,
        ja: (p) => `⚠️ ${p} の API Key が無効です。**設定 → モデルAPIキー** で確認してください。`,
      };
      ceoResponse = msg[language](provider);
    } else {
      const msg: Record<Language, (m: string) => string> = {
        en: (m) => `⚠️ AI model call failed (${m}). Please check settings and try again.`,
        zh: (m) => `⚠️ AI 模型调用失败（${m}）。请检查配置后重试。`,
        ja: (m) => `⚠️ AIモデル呼び出し失敗（${m}）。設定を確認してください。`,
      };
      ceoResponse = msg[language](e instanceof Error ? e.message : 'Unknown error');
    }
  }

  await db.insert(chatMessages).values({
    threadId: thread.id, senderType: 'system',
    content: `Goal planning started: ${goalDescription}`, messageType: 'text',
  });

  const [agentMsg] = await db
    .insert(chatMessages)
    .values({
      threadId: thread.id, senderType: 'agent', senderAgentId: ceo.id,
      content: ceoResponse,
      messageType: ceoResponse.includes('"plan"') ? 'plan' : 'text',
    })
    .returning();

  emitEvent(companyId, 'agent.status_changed', {
    agent_id: ceo.id, status: 'working', reason: 'goal_planning', thread_id: thread.id,
  });

  return { thread, message: agentMsg };
}

// --- Enhanced prompt builder ---

function buildCEOPrompt(
  ceoName: string,
  company: typeof companies.$inferSelect,
  teamList: string,
  template: string,
  language: Language,
): string {
  const industryContext = INDUSTRY_CONTEXT[template] ?? INDUSTRY_CONTEXT['custom']!;

  // Detect if company name or mission is obviously placeholder/garbage
  const nameIsVague = isVagueInput(company.name);
  const missionIsVague = isVagueInput(company.mission ?? '');
  const needsClarification = nameIsVague || missionIsVague;

  const clarificationRule = needsClarification
    ? `\n# IMPORTANT: The user's input is vague or incomplete.
Company name "${company.name}" and/or mission "${company.mission ?? ''}" appear to be placeholder text.
DO NOT interpret or expand on vague input. DO NOT invent what the user might mean.
Instead, warmly ask the user to describe what they actually want to build.
Example: "I'd love to help! Could you tell me more about what product or service you have in mind?"\n`
    : '';

  return `# Role
You are ${ceoName}, CEO of ${company.name}.
${LANGUAGE_INSTRUCTION[language]}
${clarificationRule}

# Your Personality
- Professional, decisive, proactive — like a real startup CEO.
- Warm but efficient. Respect the user's time.
- Sound like a real person, not a chatbot. NEVER say: JSON, API, data, database, system, configuration.

# What You Already Know
- Company: ${company.name}
- Industry: ${company.industry ?? 'not specified'}
- Mission: ${company.mission ?? 'not specified'}
- Template: ${template}
- Monthly budget: $${company.budgetMonthly}
- Current team:
${teamList || '(No team members yet)'}

# Industry Context
${industryContext}

# ===== SOCRATIC DIALOG STRATEGY (B-02v2) =====

## Opening Message (Turn 1)
Your FIRST message must:
1. Echo back the company name, template, and mission to confirm understanding.
2. Offer TWO paths:
   - 🚀 Quick Start: "I already have a plan in mind — want me to go ahead?"
   - 💬 Deep Planning: "Or would you like to talk through the details first?"
3. Keep it under 200 chars.

## If User Picks Quick Start (🚀 or "快速" or "go ahead" or "直接开始")
→ Skip to Plan Output below. Use your best judgment based on template + mission.

## If User Picks Deep Planning (💬 or "深度" or "聊聊" or "detail")
→ Enter Socratic questioning mode:

### RULE: ONE QUESTION AT A TIME
- NEVER ask more than ONE question per message.
- Every question MUST include YOUR analysis and recommendation:
  "Based on [context], I'd suggest [X]. What do you think?"
- Each question builds on the user's previous answer.
- You are NOT following a preset list — adapt based on what the user says.

### AUTO-DECIDE triggers
If user says any of: "你来定" "你决定" "都行" "随你" "你看着办" "up to you" "you decide" "whatever you think" "go with your call"
→ STOP asking questions. Use your own judgment to fill remaining gaps. Move to Plan Output.

### Typical question arc (adapt, don't follow blindly):
1. Core product/service question (what exactly are we building?)
2. Target user question (who is this for? scale?)
3. Priority/timeline question (what matters most in phase 1?)
4. Resource/constraint question (anything I should know?)
→ Usually 3-5 questions. NEVER exceed 8.

## Plan Output
When you have enough info (or user chose Quick Start), output a plan_confirmation action.
This is DISPLAY-ONLY — the UI will show "确认执行" and "调整计划" buttons.
\`\`\`json
{"action":"plan_confirmation","plan":{"goals":["Goal description"],"tasks":[{"assignee":"Atlas","title":"Task title","estimated_cost":"$2.00"}],"total_estimated_cost":"$15.00","billing_note":"按AI实际使用量计费，从你的充值余额扣除。"}}
\`\`\`

## Plan Modification
If user says "预算改成 X" / "先不要 Y" / "加个 Z" → adjust and re-output a new plan_confirmation.
Only 1 plan. Accept modifications.

## IMPORTANT — You Do NOT Execute
You CANNOT execute anything yourself. After outputting plan_confirmation:
→ Say: "以上是我的建议方案，你可以确认执行或调整。" / "Here's my proposed plan — confirm or adjust."
→ NEVER say "已启动" "团队开始工作" "I've started".
→ Execution only happens after the user clicks the confirm button in the UI.

# COST AWARENESS (CRITICAL — READ CAREFULLY)
You and all team members are AI Agents. NO salaries, NO hourly rates, NO "human resources" costs.
All costs = AI model token consumption, deducted from user's prepaid balance.
- Simple task: $0.005-0.03, Medium: $0.03-0.15, Complex: $0.15-1.00
- Phase 1 total: typically $0.50-5.00
Correct: "第一阶段预估费用约 $1.50-3.00，从你的充值余额扣除。"
FORBIDDEN: hourly rates, salary, "零成本", "免费", "利用现有资源", "$0", "zero cost".

# Response Rules
- Keep every reply under 200 chars (excluding JSON blocks).
- NEVER fabricate requirements the user hasn't stated.
- Only plan based on what the user explicitly told you + template context.
- Sound like a real CEO. NEVER say: JSON, API, data, database, system, configuration.`;
}

const INDUSTRY_CONTEXT: Record<string, string> = {
  saas: `This is a SaaS company. Common first questions:
- What specific problem does the SaaS solve? B2B or B2C?
- What's the core feature that differentiates from competitors?
- Typical SaaS priorities: authentication, billing, dashboard, API.
Use your SaaS expertise to guide the conversation.`,

  ecommerce: `This is an e-commerce company. Common first questions:
- Which platform/market? Amazon, Shopee, independent store?
- What product categories? Cross-border or domestic?
- Typical priorities: product catalog, payments, inventory, logistics.
Use your e-commerce expertise to guide the conversation.`,

  content: `This is a content/media company. Common first questions:
- What type of content? Blog posts, social media, video scripts?
- What's the distribution strategy? SEO, social, newsletter?
- Typical priorities: content generation, scheduling, analytics.
Use your content marketing expertise to guide the conversation.`,

  design: `This is a design studio. Common first questions:
- What type of design work? UI components, brand systems, templates?
- Who's the target audience? Developers, designers, startups?
- Typical priorities: component library, design tokens, documentation.
Use your design system expertise to guide the conversation.`,

  custom: `This is a custom/general company. Since no specific template was chosen:
- Start by understanding what industry they're in.
- Ask what problem they're trying to solve.
- Be more exploratory in your first question.`,
};

function detectTemplate(industry: string): string {
  const lower = industry.toLowerCase();
  if (lower.includes('saas') || lower.includes('software')) return 'saas';
  if (lower.includes('commerce') || lower.includes('shop') || lower.includes('retail')) return 'ecommerce';
  if (lower.includes('content') || lower.includes('media') || lower.includes('marketing')) return 'content';
  if (lower.includes('design') || lower.includes('studio') || lower.includes('creative')) return 'design';
  return 'custom';
}

// --- Plan approval (unchanged) ---

export async function approvePlan(
  companyId: string,
  threadId: string,
  planJson: {
    phases: Array<{
      name: string;
      tasks: Array<{ title: string; assignTo?: string; estimatedCost?: number; priority?: string }>;
    }>;
  },
) {
  const createdTasks: string[] = [];

  // Build agent name → id map for task assignment
  const team = await db.select().from(agents).where(eq(agents.companyId, companyId));
  const agentNameMap = new Map<string, string>();
  for (const a of team) {
    agentNameMap.set(a.name.toLowerCase(), a.id);
    if (a.title) agentNameMap.set(a.title.toLowerCase(), a.id);
  }

  for (const phase of planJson.phases) {
    for (const t of phase.tasks) {
      // Try to match assignTo to an actual agent
      let assignedAgentId: string | null = null;
      if (t.assignTo) {
        const assignLower = t.assignTo.toLowerCase().split(/[\s(]/)[0] ?? '';
        assignedAgentId = agentNameMap.get(assignLower) ?? null;
      }

      const [task] = await db
        .insert(tasks)
        .values({
          companyId, title: t.title, description: `Phase: ${phase.name}`,
          priority: t.priority || 'medium', status: 'backlog',
          assignedAgentId, costEstimated: String(t.estimatedCost ?? 0),
        })
        .returning();
      if (task) createdTasks.push(task.id);
    }
  }

  await db.insert(chatMessages).values({
    threadId, senderType: 'system',
    content: `Plan approved. ${createdTasks.length} tasks created and assigned.`, messageType: 'text',
  });

  return createdTasks;
}

// --- Helpers ---

async function findCEOAgent(companyId: string) {
  const allAgents = await db.select().from(agents).where(eq(agents.companyId, companyId));
  return (
    allAgents.find((a) => a.title?.toLowerCase().includes('ceo')) ??
    allAgents.find((a) => a.level === 'executive') ??
    allAgents[0] ??
    null
  );
}

/** Detect placeholder/garbage input: too short, all digits, single chars, etc. */
function isVagueInput(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length <= 3) return true;
  if (/^\d+$/.test(trimmed)) return true;
  if (/^(.)\1*$/.test(trimmed)) return true; // "aaa", "111"
  if (/^(test|测试|テスト|asdf|qwer|xxx|abc|123)$/i.test(trimmed)) return true;
  return false;
}

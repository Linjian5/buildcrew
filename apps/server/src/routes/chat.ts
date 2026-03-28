import { Router } from 'express';
import { z } from 'zod';
import { eq, and, count, desc, sql } from '@buildcrew/db';
import { db, companies, agents, tasks, goals, chatThreads, chatMessages } from '@buildcrew/db';
import { validate, parsePagination } from '../lib/validate.js';
import { ok, paginated, notFound, err } from '../lib/response.js';
import { param } from '../lib/params.js';
import { getUser } from '../middleware/auth.js';
import { callAI, callAIStream, AIError } from '../services/ai-client.js';
import { continueAfterUserReply } from '../services/agent-executor.js';
// approvePlan moved to confirm-plan API route
import { checkLimit } from '../middleware/plan-guard.js';
import { getRolePrompt } from '../lib/role-prompts.js';
import { detectAndExecuteAction } from '../services/aria-actions.js';
import { emitEvent } from '../ws.js';
import {
  extractAndValidateAction,
  detectMissingActionJSON,
  retryForValidAction,
  emitActionFailed,
  type CEOActionPayload,
} from '../services/action-parser.js';
import { onUserReturnAfterAbsence } from '../services/ceo-operations.js';

const router = Router();

// --- Company ownership check ---

async function ensureCompanyOwned(
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction,
) {
  const companyId = param(req, 'companyId');
  const userId = getUser(req).userId;
  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.userId, userId)));
  if (!company) return notFound(res, 'Company');
  next();
}

// --- Schemas ---

const SUPPORTED_LANGUAGES = ['en', 'zh', 'ja'] as const;
type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** Map locale variants to supported languages. e.g. zh-Hans → zh, ja-JP → ja */
function normalizeLanguage(val: unknown): string {
  if (typeof val !== 'string') return 'en';
  const lower = val.toLowerCase().trim();
  if (lower.startsWith('zh')) return 'zh';
  if (lower.startsWith('ja')) return 'ja';
  if (lower.startsWith('en')) return 'en';
  return 'en';
}

const languageSchema = z.preprocess(normalizeLanguage, z.enum(SUPPORTED_LANGUAGES));

const LANGUAGE_INSTRUCTION: Record<Language, string> = {
  en: '',
  zh: '【语言要求】你必须全程使用简体中文回复。绝不使用英文，包括专有名词也用中文。',
  ja: '【言語要求】すべて日本語で回答してください。英語は一切使用しないでください。',
};

const NO_KEY_MESSAGES: Record<Language, string> = {
  en: "⚠️ I can't work yet — you haven't configured an AI Model API Key.\n\nPlease go to **Settings → Model API Keys** to add your key (supports Claude / OpenAI / DeepSeek etc.).\n\nOnce configured, come back and talk to me — I'll start working right away!",
  zh: '⚠️ 我还无法工作——你还没有配置 AI 模型 API Key。\n\n请前往 **设置 → 模型 API Key** 添加你的 API Key（支持 Claude / OpenAI / DeepSeek 等）。\n\n配置完成后回来跟我说话，我就能真正开始工作了！',
  ja: '⚠️ まだ作業できません——AIモデルAPIキーが設定されていません。\n\n**設定 → モデルAPIキー** でキーを追加してください（Claude / OpenAI / DeepSeek 等に対応）。\n\n設定後、またお話しください。すぐに作業を開始します！',
};

const KEY_INVALID_MESSAGES: Record<Language, (provider: string) => string> = {
  en: (p) => `⚠️ Your ${p} API Key is invalid. Please go to **Settings → Model API Keys** to check and update it.`,
  zh: (p) => `⚠️ 你配置的 ${p} API Key 无效，请到 **设置 → 模型 API Key** 检查并更新。`,
  ja: (p) => `⚠️ ${p} の API Key が無効です。**設定 → モデルAPIキー** で確認・更新してください。`,
};

const GENERIC_ERROR_MESSAGES: Record<Language, (msg: string) => string> = {
  en: (msg) => `⚠️ AI model call failed: ${msg}. Please check your API Key settings or try again later.`,
  zh: (msg) => `⚠️ AI 模型调用失败：${msg}。请检查 API Key 配置或稍后重试。`,
  ja: (msg) => `⚠️ AIモデルの呼び出しに失敗しました：${msg}。APIキーの設定を確認するか、後でもう一度お試しください。`,
};

const DAILY_LIMIT_MESSAGES: Record<Language, string> = {
  en: "⚠️ You've reached the free daily limit (20 messages). To continue chatting, please add your own API Key in **Settings → Model API Keys**.",
  zh: '⚠️ 你已达到免费每日上限（20 条消息）。如需继续对话，请在 **设置 → 模型 API Key** 中添加你自己的 API Key。',
  ja: '⚠️ 無料の1日の上限（20メッセージ）に達しました。チャットを続けるには、**設定 → モデルAPIキー** で自分のAPIキーを追加してください。',
};

const createThreadSchema = z.object({
  agent_id: z.string().uuid(),
  thread_type: z.enum(['goal_planning', 'task_execution', 'question', 'report', 'onboarding']).default('question'),
  related_task_id: z.string().uuid().optional(),
  initial_message: z.string().min(1).max(10000).optional(),
  language: languageSchema.default('en'),
  template: z.enum(['saas', 'ecommerce', 'content', 'design', 'custom']).optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  message_type: z.enum(['text', 'plan', 'question', 'approval_request', 'result', 'code']).default('text'),
  metadata: z.record(z.string(), z.unknown()).optional(),
  language: languageSchema.default('en'),
  locale: z.preprocess(normalizeLanguage, z.enum(SUPPORTED_LANGUAGES)).optional(),
});

// --- Routes ---

// POST /companies/:companyId/chat/threads — Create thread
router.post(
  '/companies/:companyId/chat/threads',
  ensureCompanyOwned,
  validate(createThreadSchema),
  async (req, res, next) => {
    try {
      const companyId = param(req, 'companyId');
      const userId = getUser(req).userId;
      const body = req.body as z.infer<typeof createThreadSchema>;

      // Verify agent belongs to this company
      const [agent] = await db
        .select()
        .from(agents)
        .where(and(eq(agents.id, body.agent_id), eq(agents.companyId, companyId)));
      if (!agent) return notFound(res, 'Agent');

      const [thread] = await db
        .insert(chatThreads)
        .values({
          companyId,
          agentId: body.agent_id,
          userId,
          threadType: body.thread_type,
          relatedTaskId: body.related_task_id,
          status: 'active',
        })
        .returning();

      if (!thread) return err(res, 500, 'CREATE_FAILED', 'Failed to create thread');

      // If initial message provided, add it + generate agent response
      let userMessage = null;
      let agentResponse = null;

      if (body.initial_message) {
        const [userMsg] = await db
          .insert(chatMessages)
          .values({
            threadId: thread.id,
            senderType: 'system',
            content: body.initial_message,
            messageType: 'text',
          })
          .returning();
        userMessage = userMsg ? formatMessage(userMsg) : null;

        // Try AI call, with clear error messages on failure
        const runtime = agent.runtimeConfig as { provider?: string; model?: string } | null;
        const provider = runtime?.provider ?? 'anthropic';
        const model = runtime?.model ?? 'claude-sonnet-4';
        const [companyForAI] = await db.select().from(companies).where(eq(companies.id, companyId));
        const snapshot = await getCompanySnapshot(companyId);

        let responseContent: string;
        let tokenUsage: Record<string, unknown> | null = null;
        try {
          const result = await callAI({
            userId,
            agentId: agent.id,
            companyId,
            provider,
            model,
            systemPrompt: buildThreadSystemPrompt(agent, companyForAI, body.thread_type, body.language, snapshot, false, body.template),
            messages: [{ role: 'user', content: body.initial_message }],
            requestType: 'chat',
            allowPlatformKey: true,
            maxTokens: 800,
          });
          responseContent = result.content;
          tokenUsage = { prompt_tokens: result.tokenUsage.prompt, completion_tokens: result.tokenUsage.completion, cost_usd: result.tokenUsage.cost };
        } catch (e) {
          responseContent = buildAIErrorMessage(e, provider, body.language);
        }

        // Multi-layer JSON extraction + zod validation
        const parseResult = extractAndValidateAction(responseContent);

        const [agentMsg] = await db
          .insert(chatMessages)
          .values({
            threadId: thread.id,
            senderType: 'agent',
            senderAgentId: agent.id,
            content: parseResult.displayText,
            messageType: parseResult.structuredData ? 'plan' : 'text',
            metadata: parseResult.structuredData ? { team: parseResult.structuredData } : {},
            tokenUsage,
          })
          .returning();
        agentResponse = agentMsg ? formatMessage(agentMsg) : null;

        // Chat phase: NEVER auto-execute. All execution goes through confirm-plan API.
        // structuredData is stored in metadata for frontend to render confirm/adjust buttons.

        // Update thread status
        await db
          .update(chatThreads)
          .set({ status: 'active', updatedAt: new Date() })
          .where(eq(chatThreads.id, thread.id));
      }

      ok(
        res,
        {
          thread: formatThread(thread, agent.name, agent.department),
          user_message: userMessage,
          agent_response: agentResponse,
        },
        201,
      );
    } catch (e) {
      next(e);
    }
  },
);

// GET /companies/:companyId/chat/threads — List threads
router.get('/companies/:companyId/chat/threads', ensureCompanyOwned, async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const offset = (page - 1) * limit;

    const conditions = [eq(chatThreads.companyId, companyId)];
    const agentId = req.query['agent_id'] as string | undefined;
    const status = req.query['status'] as string | undefined;
    if (agentId) conditions.push(eq(chatThreads.agentId, agentId));
    if (status) conditions.push(eq(chatThreads.status, status));

    const where = and(...conditions);

    const [rows, [countRow]] = await Promise.all([
      db.select().from(chatThreads).where(where).limit(limit).offset(offset).orderBy(desc(chatThreads.updatedAt)),
      db.select({ total: count() }).from(chatThreads).where(where),
    ]);

    // Get agent names + departments
    const agentIds = [...new Set(rows.map((r) => r.agentId))];
    const agentRows =
      agentIds.length > 0
        ? await db.select({ id: agents.id, name: agents.name, department: agents.department }).from(agents).where(
            eq(agents.companyId, companyId),
          )
        : [];
    const agentMap = new Map(agentRows.map((a) => [a.id, { name: a.name, department: a.department }]));

    const data = rows.map((r) => {
      const info = agentMap.get(r.agentId);
      return formatThread(r, info?.name ?? 'Unknown', info?.department ?? null);
    });

    paginated(res, data, { page, limit, total: Number(countRow?.total ?? 0) });
  } catch (e) {
    next(e);
  }
});

// GET /companies/:companyId/chat/threads/:threadId — Thread detail + messages
router.get('/companies/:companyId/chat/threads/:threadId', ensureCompanyOwned, async (req, res, next) => {
  try {
    const threadId = param(req, 'threadId');
    const companyId = param(req, 'companyId');

    const [thread] = await db
      .select()
      .from(chatThreads)
      .where(and(eq(chatThreads.id, threadId), eq(chatThreads.companyId, companyId)));
    if (!thread) return notFound(res, 'Thread');

    const [agent] = await db.select({ name: agents.name, department: agents.department }).from(agents).where(eq(agents.id, thread.agentId));
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.threadId, threadId))
      .orderBy(chatMessages.createdAt);

    ok(res, {
      thread: formatThread(thread, agent?.name ?? 'Unknown', agent?.department ?? null),
      messages: messages.map(formatMessage),
    });
  } catch (e) {
    next(e);
  }
});

// POST /companies/:companyId/chat/threads/:threadId/messages — Send message
router.post(
  '/companies/:companyId/chat/threads/:threadId/messages',
  ensureCompanyOwned,
  checkLimit('daily_messages'),
  validate(sendMessageSchema),
  async (req, res, next) => {
    try {
      const threadId = param(req, 'threadId');
      const companyId = param(req, 'companyId');
      const body = req.body as z.infer<typeof sendMessageSchema>;
      // B-00a: locale takes priority over language
      const effectiveLanguage: Language = (body.locale ?? body.language) as Language;

      const [thread] = await db
        .select()
        .from(chatThreads)
        .where(and(eq(chatThreads.id, threadId), eq(chatThreads.companyId, companyId)));
      if (!thread) return notFound(res, 'Thread');

      if (thread.status === 'closed') {
        return err(res, 400, 'THREAD_CLOSED', 'Cannot send messages to a closed thread');
      }

      // Insert user message
      const [userMsg] = await db
        .insert(chatMessages)
        .values({
          threadId,
          senderType: 'user',
          content: body.content,
          messageType: body.message_type,
          metadata: body.metadata ?? {},
        })
        .returning();

      // S4-B06: If this is a question thread waiting for user → trigger continuation
      if (thread.threadType === 'question' && thread.status === 'waiting_user') {
        const continuation = await continueAfterUserReply(threadId, body.content).catch(() => null);
        if (continuation) {
          // Get the agent's continuation message
          const latestMessages = await db
            .select()
            .from(chatMessages)
            .where(eq(chatMessages.threadId, threadId))
            .orderBy(desc(chatMessages.createdAt))
            .limit(1);

          const agentReply = latestMessages[0];

          return ok(res, {
            user_message: userMsg ? formatMessage(userMsg) : null,
            agent_response: agentReply ? formatMessage(agentReply) : null,
            thread_status: 'active',
            task_resumed: continuation.taskId,
          });
        }
      }

      // Plan execution is now triggered by dedicated POST /confirm-plan API, not by chat text detection.
      // Aria outputs plan_confirmation action JSON, frontend shows confirm/adjust buttons.

      // Get agent info for response
      const [agent] = await db.select().from(agents).where(eq(agents.id, thread.agentId));
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));

      // Detect and execute task management commands (pause/reassign/prioritize)
      let actionContext = '';
      if (agent?.title?.toLowerCase().includes('ceo')) {
        const action = await detectAndExecuteAction(companyId, body.content);
        if (action.executed && action.details) {
          actionContext = `\n[SYSTEM: Action executed — ${action.details}. Confirm this to the user in your reply.]\n`;
        }
      }

      const runtime = agent?.runtimeConfig as { provider?: string; model?: string } | null;
      const provider = runtime?.provider ?? 'anthropic';
      const model = runtime?.model ?? 'claude-sonnet-4';

      const history = await db
        .select().from(chatMessages).where(eq(chatMessages.threadId, threadId))
        .orderBy(chatMessages.createdAt).limit(20);

      const aiMessages = history.map((m) => ({
        role: (m.senderType === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }));
      aiMessages.push({ role: 'user', content: body.content + actionContext });

      const snapshot = await getCompanySnapshot(companyId);
      // Check if team was already confirmed in this thread (has a 'plan' message)
      const teamConfirmed = thread.threadType === 'onboarding' && history.some((m) => m.messageType === 'plan');
      const aiParams = {
        userId: getUser(req).userId,
        agentId: thread.agentId,
        companyId,
        provider,
        model,
        systemPrompt: buildThreadSystemPrompt(
          { name: agent?.name ?? 'Agent', title: agent?.title ?? 'Assistant', department: agent?.department ?? '' },
          company ?? undefined,
          thread.threadType ?? 'question',
          effectiveLanguage,
          snapshot,
          teamConfirmed,
          company?.template ?? undefined,
        ),
        messages: aiMessages,
        requestType: 'chat' as const,
        allowPlatformKey: true,
        maxTokens: 800,
      };

      // --- SSE streaming path ---
      if (req.headers.accept?.includes('text/event-stream')) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        res.write(`data: ${JSON.stringify({ type: 'user_message', message: userMsg ? formatMessage(userMsg) : null })}\n\n`);

        let fullContent = '';
        try {
          for await (const chunk of callAIStream(aiParams)) {
            if (chunk.type === 'delta' && chunk.content) {
              fullContent += chunk.content;
              res.write(`data: ${JSON.stringify({ type: 'delta', content: chunk.content })}\n\n`);
            } else if (chunk.type === 'done') {
              fullContent = chunk.content ?? fullContent;

              // B-01: Parse action JSON from streamed response
              const streamParse = extractAndValidateAction(fullContent);
              let streamActionData: CEOActionPayload | null = streamParse.structuredData;
              let streamNeedsReview = false;

              if (!streamActionData && detectMissingActionJSON(fullContent)) {
                const retryResult = await retryForValidAction(
                  {
                    userId: getUser(req).userId,
                    agentId: thread.agentId,
                    companyId,
                    provider,
                    model,
                    originalMessages: aiMessages,
                    originalSystemPrompt: aiParams.systemPrompt,
                  },
                  fullContent,
                );
                if (retryResult.structuredData) {
                  streamActionData = retryResult.structuredData;
                  res.write(`data: ${JSON.stringify({ type: 'action_retry_success', retry_count: retryResult.retryCount })}\n\n`);
                } else {
                  streamNeedsReview = true;
                  emitActionFailed(companyId, {
                    threadId,
                    agentId: thread.agentId,
                    retryCount: retryResult.retryCount,
                    error: retryResult.finalError ?? 'Failed to extract action JSON',
                    originalContent: fullContent,
                  });
                }
              }

              const streamMeta: Record<string, unknown> = streamActionData ? { team: streamActionData } : {};
              if (streamNeedsReview) {
                streamMeta['needs_human_review'] = true;
              }

              const [savedMsg] = await db.insert(chatMessages).values({
                threadId,
                senderType: 'agent',
                senderAgentId: thread.agentId,
                content: streamParse.displayText,
                messageType: streamActionData ? 'plan' : 'text',
                metadata: streamMeta,
              }).returning();

              // Chat phase: no auto-execution. Data stored in metadata for confirm-plan API.

              const threadStatus = streamNeedsReview ? 'waiting_user' : 'active';
              await db.update(chatThreads).set({ status: threadStatus, updatedAt: new Date() }).where(eq(chatThreads.id, threadId));
              res.write(`data: ${JSON.stringify({ type: 'done', message: savedMsg ? formatMessage(savedMsg) : null, token_usage: chunk.tokenUsage, thread_status: threadStatus, needs_human_review: streamNeedsReview || undefined })}\n\n`);
            } else if (chunk.type === 'error') {
              res.write(`data: ${JSON.stringify({ type: 'error', content: chunk.error })}\n\n`);
            }
          }
        } catch (e) {
          const errMsg = buildAIErrorMessage(e, provider, effectiveLanguage);
          const [savedMsg] = await db.insert(chatMessages).values({ threadId, senderType: 'agent', senderAgentId: thread.agentId, content: errMsg, messageType: 'text' }).returning();
          await db.update(chatThreads).set({ status: 'active', updatedAt: new Date() }).where(eq(chatThreads.id, threadId));
          res.write(`data: ${JSON.stringify({ type: 'done', message: savedMsg ? formatMessage(savedMsg) : null, thread_status: 'active' })}\n\n`);
        }
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      // --- Non-streaming path ---
      let responseContent: string;
      try {
        const result = await callAI(aiParams);
        responseContent = result.content;
      } catch (e) {
        responseContent = buildAIErrorMessage(e, provider, effectiveLanguage);
      }

      // B-01: Multi-layer JSON extraction + zod validation + retry
      const parseResult = extractAndValidateAction(responseContent);
      let finalData: CEOActionPayload | null = parseResult.structuredData;
      let needsHumanReview = false;

      // If no valid action JSON but CEO mentioned team changes → retry
      if (!finalData && detectMissingActionJSON(responseContent)) {
        const retryResult = await retryForValidAction(
          {
            userId: getUser(req).userId,
            agentId: thread.agentId,
            companyId,
            provider,
            model,
            originalMessages: aiMessages,
            originalSystemPrompt: aiParams.systemPrompt,
          },
          responseContent,
        );

        if (retryResult.structuredData) {
          finalData = retryResult.structuredData;
        } else {
          // All retries exhausted → mark needs_human_review
          needsHumanReview = true;
          emitActionFailed(companyId, {
            threadId,
            agentId: thread.agentId,
            retryCount: retryResult.retryCount,
            error: retryResult.finalError ?? 'Failed to extract action JSON after retries',
            originalContent: responseContent,
          });
        }
      } else if (!finalData && parseResult.validationErrors) {
        // JSON found but validation failed → retry
        const retryResult = await retryForValidAction(
          {
            userId: getUser(req).userId,
            agentId: thread.agentId,
            companyId,
            provider,
            model,
            originalMessages: aiMessages,
            originalSystemPrompt: aiParams.systemPrompt,
          },
          responseContent,
        );

        if (retryResult.structuredData) {
          finalData = retryResult.structuredData;
        } else {
          needsHumanReview = true;
          emitActionFailed(companyId, {
            threadId,
            agentId: thread.agentId,
            retryCount: retryResult.retryCount,
            error: `Validation errors: ${parseResult.validationErrors.join('; ')}`,
            originalContent: responseContent,
          });
        }
      }

      const msgMetadata: Record<string, unknown> = finalData ? { team: finalData } : {};
      if (needsHumanReview) {
        msgMetadata['needs_human_review'] = true;
        msgMetadata['review_reason'] = 'action_json_extraction_failed';
      }

      const [agentMsg] = await db
        .insert(chatMessages)
        .values({
          threadId,
          senderType: 'agent' as const,
          senderAgentId: thread.agentId,
          content: parseResult.displayText,
          messageType: finalData ? 'plan' : 'text',
          metadata: msgMetadata,
        })
        .returning();

      // Chat phase: no auto-execution. finalData stored in message metadata for confirm-plan API.

      // Update thread timestamp + mark review status
      const threadUpdate: Record<string, unknown> = { status: 'active', updatedAt: new Date() };
      if (needsHumanReview) {
        threadUpdate['status'] = 'waiting_user';
      }
      await db
        .update(chatThreads)
        .set(threadUpdate)
        .where(eq(chatThreads.id, threadId));

      ok(res, {
        user_message: userMsg ? formatMessage(userMsg) : null,
        agent_response: agentMsg ? formatMessage(agentMsg) : null,
        thread_status: needsHumanReview ? 'waiting_user' : 'active',
        needs_human_review: needsHumanReview || undefined,
      });
    } catch (e) {
      next(e);
    }
  },
);

// GET /companies/:companyId/chat/active-thread — Get or create active CEO thread
router.get('/companies/:companyId/chat/active-thread', ensureCompanyOwned, async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');
    const userId = getUser(req).userId;
    const language = (req.query['language'] as Language) ?? 'en';

    // Find CEO agent
    const allAgents = await db.select().from(agents).where(eq(agents.companyId, companyId));
    const ceo = allAgents.find((a) => a.title?.toLowerCase().includes('ceo')) ?? allAgents[0];
    if (!ceo) return ok(res, { thread: null, messages: [], needs_onboarding: true });

    // Look for existing active CEO thread (goal_planning or question, not closed)
    const [existingThread] = await db.select().from(chatThreads).where(
      and(
        eq(chatThreads.companyId, companyId),
        eq(chatThreads.agentId, ceo.id),
        sql`${chatThreads.status} != 'closed'`,
      ),
    ).orderBy(desc(chatThreads.updatedAt)).limit(1);

    if (existingThread) {
      // Check if last message is older than 24 hours
      const messages = await db.select().from(chatMessages)
        .where(eq(chatMessages.threadId, existingThread.id))
        .orderBy(chatMessages.createdAt);

      const lastMsg = messages[messages.length - 1];
      const msElapsed = lastMsg?.createdAt ? Date.now() - lastMsg.createdAt.getTime() : 0;
      const stale = msElapsed > 24 * 60 * 60 * 1000;

      // B-05v2: Check for 3+ day absence
      const daysAbsent = Math.floor(msElapsed / (24 * 60 * 60 * 1000));
      if (daysAbsent >= 3) {
        onUserReturnAfterAbsence({ companyId, daysSinceLastVisit: daysAbsent }).catch(() => {});
      }

      if (stale) {
        // CEO sends a proactive update
        const snapshot = await getCompanySnapshot(companyId);
        const proactiveMsg = await generateCEOProactiveMessage(ceo, companyId, userId, snapshot, language);
        if (proactiveMsg) {
          await db.insert(chatMessages).values({
            threadId: existingThread.id, senderType: 'agent', senderAgentId: ceo.id,
            content: proactiveMsg, messageType: 'text',
          });
          await db.update(chatThreads).set({ updatedAt: new Date() }).where(eq(chatThreads.id, existingThread.id));
          messages.push({ id: '', threadId: existingThread.id, senderType: 'agent', senderAgentId: ceo.id, content: proactiveMsg, messageType: 'text', metadata: {}, tokenUsage: null, createdAt: new Date() } as typeof chatMessages.$inferSelect);
        }
      }

      return ok(res, {
        thread: formatThread(existingThread, ceo.name, ceo.department),
        messages: messages.map(formatMessage),
        needs_onboarding: false,
      });
    }

    // No active thread — create one with a proactive CEO message
    const snapshot = await getCompanySnapshot(companyId);
    const [newThread] = await db.insert(chatThreads).values({
      companyId, agentId: ceo.id, userId,
      threadType: 'goal_planning', status: 'active',
    }).returning();

    if (!newThread) return ok(res, { thread: null, messages: [], needs_onboarding: true });

    const proactiveMsg = await generateCEOProactiveMessage(ceo, companyId, userId, snapshot, language);
    const msgContent = proactiveMsg ?? getStaticFallback(language);

    const [agentMsg] = await db.insert(chatMessages).values({
      threadId: newThread.id, senderType: 'agent', senderAgentId: ceo.id,
      content: msgContent, messageType: 'text',
    }).returning();

    return ok(res, {
      thread: formatThread(newThread, ceo.name, ceo.department),
      messages: agentMsg ? [formatMessage(agentMsg)] : [],
      needs_onboarding: false,
    });
  } catch (e) {
    next(e);
  }
});

// --- Extracted confirm-plan logic (used by both route and launch.ts) ---

interface ConfirmPlanParams {
  threadId: string;
  companyId: string;
  userId: string;
  language: Language;
}

interface ConfirmPlanResult {
  data?: {
    status: 'ready' | 'need_info' | 'executed';
    scenario?: string;
    hired?: string[];
    budget_allocated?: boolean;
    missing?: string[];
    message?: string;
    goals_created?: number;
    tasks_created?: number;
    tasks_assigned?: number;
  };
  error?: { code: string; message: string };
  httpStatus?: number;
}

// ============================================================
//  confirm-plan: Extract context → Scenario A or B
// ============================================================

const CONTEXT_EXTRACT_PROMPT = `You are analyzing an onboarding conversation between a user and their AI CEO (Aria).
Your job: determine whether THREE elements have been agreed upon by the user.

Output ONLY valid JSON:
{
  "has_plan": true/false,
  "has_team": true/false,
  "has_budget": true/false,
  "plan": { "phases": [{"name":"Phase name","goals":["goal"],"tasks":[{"title":"task","assignee":"RoleName","priority":"high","estimated_cost":0.03}]}] },
  "team": [{"name":"Atlas","role":"CTO","responsibility":"Technical architecture"}],
  "budget": { "total": 2.5, "breakdown": [{"role":"Atlas","amount":0.8}] },
  "missing_info": "具体缺什么（如果有缺失的话）"
}

RULES:
1. has_plan = true ONLY if user explicitly agreed to a plan with phases/goals/tasks.
2. has_team = true ONLY if user explicitly agreed to specific team members (role names).
3. has_budget = true ONLY if user explicitly agreed to a budget number, OR Aria proposed costs and user didn't object.
4. Extract ONLY what's in the conversation. Do NOT add roles, tasks, or goals not discussed.
5. Role template names: Atlas, Nova, Echo, Sentinel, Vector, Pixel, Sage, Scout, Cipher. Do NOT include Aria/CEO.
6. If user said "你来定/你决定/都行" for a missing element, treat it as agreed with Aria's suggestion.
7. estimated_cost per task: simple $0.005-0.03, medium $0.03-0.15, complex $0.15-1.00. Phase 1 total: $0.50-5.00.
8. If information is missing, set the corresponding has_* to false and describe what's missing in missing_info.`;

type ExtractedContext = {
  has_plan: boolean;
  has_team: boolean;
  has_budget: boolean;
  plan?: { phases: Array<{ name: string; goals?: string[]; tasks?: Array<{ title: string; assignee?: string; priority?: string; estimated_cost?: number }> }> };
  team?: Array<{ name: string; role?: string; responsibility?: string }>;
  budget?: { total?: number; breakdown?: Array<{ role: string; amount: number }> };
  missing_info?: string;
};

export async function executeConfirmPlan(params: ConfirmPlanParams): Promise<ConfirmPlanResult> {
  const { threadId, companyId, userId, language } = params;

  const [thread] = await db.select().from(chatThreads)
    .where(and(eq(chatThreads.id, threadId), eq(chatThreads.companyId, companyId)));
  if (!thread) return { error: { code: 'NOT_FOUND', message: 'Thread not found' }, httpStatus: 404 };

  // --- Step 1: Get full conversation history ---
  const allMessages = await db.select().from(chatMessages)
    .where(eq(chatMessages.threadId, threadId))
    .orderBy(chatMessages.createdAt);

  if (allMessages.length === 0) {
    return { error: { code: 'EMPTY_THREAD', message: 'No conversation found.' }, httpStatus: 400 };
  }

  const conversationText = allMessages
    .filter((m) => m.senderType !== 'system' || !(m.metadata as Record<string, unknown> | null)?.internal)
    .map((m) => `[${m.senderType === 'user' ? 'User' : 'Aria'}]: ${m.content}`)
    .join('\n\n');

  // --- Step 2: AI extracts three elements ---
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  const existingTeam = await db.select().from(agents).where(eq(agents.companyId, companyId));
  const ceo = existingTeam.find((a) => a.title?.toLowerCase().includes('ceo'));
  if (!ceo) return { error: { code: 'NO_CEO', message: 'No CEO agent found' }, httpStatus: 400 };

  const runtime = ceo.runtimeConfig as { provider?: string; model?: string } | null;

  const extractResult = await callAI({
    userId, agentId: ceo.id, companyId,
    provider: runtime?.provider ?? 'deepseek', model: runtime?.model ?? 'deepseek-chat',
    systemPrompt: CONTEXT_EXTRACT_PROMPT,
    messages: [{ role: 'user', content: `Company: ${company?.name ?? 'Unknown'}\nMission: ${company?.mission ?? 'Not set'}\nTemplate: ${company?.template ?? 'custom'}\n\nFull conversation:\n${conversationText}` }],
    requestType: 'plan_parsing', allowPlatformKey: true, maxTokens: 1200,
  });

  let extracted: ExtractedContext | null = null;
  try { extracted = JSON.parse(extractResult.content.trim()); } catch {}
  if (!extracted) {
    const m = extractResult.content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (m?.[1]) { try { extracted = JSON.parse(m[1]); } catch {} }
  }
  if (!extracted) {
    return { error: { code: 'EXTRACT_FAILED', message: 'Failed to analyze conversation.' }, httpStatus: 500 };
  }

  // --- Validate: team count must match conversation ---
  if (extracted.team) {
    const knownRoles = ['atlas', 'nova', 'echo', 'sentinel', 'vector', 'pixel', 'sage', 'scout', 'cipher'];
    const mentionedInConvo = knownRoles.filter((r) => conversationText.toLowerCase().includes(r));
    if (mentionedInConvo.length > 0 && extracted.team.length > mentionedInConvo.length) {
      extracted.team = mentionedInConvo.map((r) => ({
        name: r.charAt(0).toUpperCase() + r.slice(1),
        role: extracted!.team?.find((t) => t.name.toLowerCase() === r)?.role,
        responsibility: extracted!.team?.find((t) => t.name.toLowerCase() === r)?.responsibility,
      }));
    }
  }

  // --- Step 3: Scenario check ---
  const allReady = extracted.has_plan && extracted.has_team && extracted.has_budget;

  if (!allReady) {
    // === SCENARIO B: Missing info — ask user, don't execute ===
    const missingParts: string[] = [];
    if (!extracted.has_plan) missingParts.push('plan');
    if (!extracted.has_team) missingParts.push('team');
    if (!extracted.has_budget) missingParts.push('budget');

    // Generate a CEO message asking for missing info
    const askResult = await callAI({
      userId, agentId: ceo.id, companyId,
      provider: runtime?.provider ?? 'deepseek', model: runtime?.model ?? 'deepseek-chat',
      systemPrompt: `You are ${ceo.name}, CEO. The user clicked "Launch" but the plan is incomplete. Missing: ${missingParts.join(', ')}. Ask for the missing info naturally. Keep under 200 chars. ${LANGUAGE_INSTRUCTION[language]}`,
      messages: [{ role: 'user', content: extracted.missing_info || `Missing: ${missingParts.join(', ')}` }],
      requestType: 'chat', allowPlatformKey: true, maxTokens: 300,
    });

    await db.insert(chatMessages).values({
      threadId, senderType: 'agent', senderAgentId: ceo.id,
      content: askResult.content, messageType: 'text',
      metadata: { action_type: 'missing_info', missing: missingParts },
    });
    await db.update(chatThreads).set({ status: 'waiting_user', updatedAt: new Date() }).where(eq(chatThreads.id, threadId));

    emitEvent(companyId, 'ceo.missing_info', { thread_id: threadId, missing: missingParts });

    return {
      data: {
        status: 'need_info',
        scenario: 'missing_info',
        missing: missingParts,
        message: askResult.content,
      },
    };
  }

  // === SCENARIO A: All ready — ONLY hire + allocate budget. NO tasks, NO work loop. ===

  const { ROLE_TEMPLATES, resolveRoleKey } = await import('../lib/role-templates.js');
  const budgetNum = Number(company?.budgetMonthly ?? 300);

  // Bug #10 fix: Diff existing non-CEO agents against the new plan.
  // Delete agents not in the new plan, keep those already matching.
  const nonCeoAgents = existingTeam.filter((a) => !a.title?.toLowerCase().includes('ceo'));
  const plannedNames = new Set(
    (extracted.team ?? [])
      .filter((m) => m.name.toLowerCase() !== 'aria' && m.role?.toLowerCase() !== 'ceo')
      .map((m) => {
        const key = resolveRoleKey(m.name);
        return (key ? (ROLE_TEMPLATES[key]?.name ?? m.name) : m.name).toLowerCase();
      }),
  );

  // Remove agents not in the new plan
  for (const agent of nonCeoAgents) {
    if (!plannedNames.has(agent.name.toLowerCase())) {
      await db.delete(agents).where(eq(agents.id, agent.id));
      emitEvent(companyId, 'agent.status_changed', { action: 'removed', name: agent.name });
    }
  }

  // Hire agents in the plan that don't already exist
  const afterCleanup = await db.select().from(agents).where(eq(agents.companyId, companyId));
  const currentNames = new Set(afterCleanup.map((a) => a.name.toLowerCase()));
  const hiredAgents: string[] = [];

  if (extracted.team) {
    for (const member of extracted.team) {
      if (member.name.toLowerCase() === 'aria' || member.role?.toLowerCase() === 'ceo') continue;

      const key = resolveRoleKey(member.name);
      const tpl = key ? ROLE_TEMPLATES[key] : null;
      const name = tpl?.name ?? member.name;
      if (currentNames.has(name.toLowerCase())) continue;

      // Bug #16: Use plan's title/role if provided, fallback to template
      const title = member.role ?? tpl?.title ?? name;

      await db.insert(agents).values({
        companyId, name, title,
        department: tpl?.department ?? 'general', level: tpl?.level ?? 'mid',
        reportsTo: ceo.id, status: 'idle',
        runtimeConfig: { provider: 'deepseek', model: 'deepseek-chat' },
        budgetMonthly: String(Math.round(budgetNum * (tpl?.budgetPct ?? 0.08))),
        budgetSpent: '0', heartbeatIntervalSec: 300, maxConcurrentTasks: 2,
      });
      hiredAgents.push(name);
      currentNames.add(name.toLowerCase());
      emitEvent(companyId, 'agent.status_changed', { action: 'hired', name });
    }
  }

  // 2. Build summary message — language-aware, no mixing (Bug #13)
  // Bug #15: total cost = sum of task costs, not AI's invented number
  let computedTotal = 0;
  const allPlanTasks = extracted.plan?.phases?.flatMap((p) => p.tasks ?? []) ?? [];
  for (const t of allPlanTasks) computedTotal += (t.estimated_cost ?? 0);
  computedTotal = Math.round(computedTotal * 1000) / 1000;

  const teamSummary = (extracted.team ?? []).map((t) =>
    `• **${t.name}** (${t.role ?? (language === 'zh' ? '成员' : language === 'ja' ? 'メンバー' : 'Member')}) — ${t.responsibility ?? ''}`,
  ).join('\n');

  const planPreview = extracted.plan?.phases?.map((p) =>
    `**${p.name}**\n${(p.tasks ?? []).map((t) => `  - ${t.title} → ${t.assignee ?? ''} ($${(t.estimated_cost ?? 0).toFixed(3)})`).join('\n')}`,
  ).join('\n') ?? '';

  const labels = {
    en: { team: 'Team Ready', plan: 'Planned Tasks', cost: 'Estimated Cost', note: 'deducted from your balance', cta: 'Click "Execute" to create goals, tasks, and assign them to the team.' },
    zh: { team: '团队已就位', plan: '待执行计划', cost: '预估总费用', note: '从充值余额扣除', cta: '点击「立即执行」后，我会创建目标、拆解任务并分配给团队成员。' },
    ja: { team: 'チーム準備完了', plan: '実行予定タスク', cost: '見積もり総額', note: '残高から差し引かれます', cta: '「実行」をクリックすると、目標を作成しタスクをチームに割り当てます。' },
  } as const;
  const l = labels[language];

  const summaryContent = [
    teamSummary ? `**${l.team}:**\n${teamSummary}` : '',
    planPreview ? `\n**${l.plan}:**\n${planPreview}` : '',
    `\n**${l.cost}:** $${computedTotal.toFixed(2)}（${l.note}）`,
    `\n${l.cta}`,
  ].filter(Boolean).join('\n');

  // 3. Post CEO message with ready_to_execute action — frontend renders "立即执行" button
  await db.insert(chatMessages).values({
    threadId, senderType: 'agent', senderAgentId: ceo.id,
    content: summaryContent,
    messageType: 'plan',
    metadata: { action_type: 'ready_to_execute', team: extracted.team, plan: extracted.plan, budget: extracted.budget },
  });

  // 4. Set workflow to waiting_confirmation — NO work loop, NO tasks created
  await db.update(chatThreads).set({
    status: 'active',
    workflowState: 'waiting_confirmation',
    updatedAt: new Date(),
  }).where(eq(chatThreads.id, threadId));

  emitEvent(companyId, 'plan.ready_to_execute', { thread_id: threadId, hired: hiredAgents });

  return {
    data: {
      status: 'ready',
      scenario: 'all_ready',
      hired: hiredAgents,
      budget_allocated: true,
    },
  };
}

// ============================================================
//  execute-plan: User clicked "立即执行" button
// ============================================================

export async function executeReadyPlan(params: { threadId: string; companyId: string; userId: string; language: Language }): Promise<ConfirmPlanResult> {
  const { threadId, companyId, language } = params;

  const [thread] = await db.select().from(chatThreads)
    .where(and(eq(chatThreads.id, threadId), eq(chatThreads.companyId, companyId)));
  if (!thread) return { error: { code: 'NOT_FOUND', message: 'Thread not found' }, httpStatus: 404 };

  if (thread.workflowState !== 'waiting_confirmation') {
    return { error: { code: 'INVALID_STATE', message: 'Plan is not in waiting_confirmation state.' }, httpStatus: 400 };
  }

  // Find the ready_to_execute message to get the stored plan
  const planMsg = await db.select().from(chatMessages)
    .where(eq(chatMessages.threadId, threadId))
    .orderBy(desc(chatMessages.createdAt)).limit(20);

  let storedPlan: ExtractedContext['plan'] | null = null;
  for (const msg of planMsg) {
    const meta = msg.metadata as Record<string, unknown> | null;
    if (meta?.action_type === 'ready_to_execute' && meta.plan) {
      storedPlan = meta.plan as ExtractedContext['plan'];
      break;
    }
  }

  if (!storedPlan?.phases) {
    return { error: { code: 'NO_STORED_PLAN', message: 'No stored plan found. Click "启动" first.' }, httpStatus: 400 };
  }

  // Get team
  const team = await db.select().from(agents).where(eq(agents.companyId, companyId));
  const ceo = team.find((a) => a.title?.toLowerCase().includes('ceo'));
  if (!ceo) return { error: { code: 'NO_CEO', message: 'No CEO agent found' }, httpStatus: 400 };

  const agentMap = new Map<string, string>();
  for (const a of team) agentMap.set(a.name.toLowerCase(), a.id);

  // 1. Create goals
  const createdGoalIds: string[] = [];
  for (const phase of storedPlan.phases) {
    if (phase.goals) {
      for (const g of phase.goals) {
        const [goal] = await db.insert(goals).values({ companyId, title: g, description: `Phase: ${phase.name}` }).returning();
        if (goal) createdGoalIds.push(goal.id);
      }
    }
  }

  // 2. Create + assign tasks
  let taskCount = 0;
  for (const phase of storedPlan.phases) {
    if (phase.tasks) {
      for (const t of phase.tasks) {
        let assignedAgentId: string | null = null;
        if (t.assignee) {
          assignedAgentId = agentMap.get(t.assignee.toLowerCase().split(/[\s(]/)[0] ?? '') ?? null;
        }
        await db.insert(tasks).values({
          companyId, title: t.title, priority: t.priority ?? 'medium',
          status: 'backlog', assignedAgentId, goalId: createdGoalIds[0] ?? null,
          costEstimated: String(t.estimated_cost ?? 0),
        });
        taskCount++;
      }
    }
  }

  // 3. Post Aria's notification
  const langMsgs = {
    en: `Tasks assigned and the team is starting work. ${taskCount} tasks across ${createdGoalIds.length} goal(s). I'll keep you posted on progress.`,
    zh: `任务已分配，团队开始工作。共 ${taskCount} 个任务，${createdGoalIds.length} 个目标。我会随时向你汇报进展。`,
    ja: `タスクが割り当てられ、チームが作業を開始しました。${taskCount}タスク、${createdGoalIds.length}目標。進捗は随時お知らせします。`,
  } as const;

  await db.insert(chatMessages).values({
    threadId, senderType: 'agent', senderAgentId: ceo.id,
    content: langMsgs[language],
    messageType: 'text',
  });

  // 4. Update workflow state → completed (initial setup done)
  await db.update(chatThreads).set({
    status: 'active',
    workflowState: 'completed',
    updatedAt: new Date(),
  }).where(eq(chatThreads.id, threadId));

  emitEvent(companyId, 'plan.execution_started', { thread_id: threadId, tasks_created: taskCount, goals_created: createdGoalIds.length });

  return {
    data: {
      status: 'executed',
      goals_created: createdGoalIds.length,
      tasks_created: taskCount,
      tasks_assigned: taskCount,
    },
  };
}

// --- Route: confirm-plan (user clicks "启动") ---
router.post(
  '/companies/:companyId/chat/threads/:threadId/confirm-plan',
  ensureCompanyOwned,
  async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      const p = {
        threadId: param(req, 'threadId'),
        companyId: param(req, 'companyId'),
        userId: getUser(req).userId,
        language: (body.language ?? 'en') as Language,
      };

      // If execute: true, this is the "立即执行" button
      if (body.execute === true) {
        const result = await executeReadyPlan(p);
        if (result.error) return err(res, result.httpStatus ?? 400, result.error.code, result.error.message);
        return ok(res, result.data);
      }

      // Default: analyze and prepare
      const result = await executeConfirmPlan(p);
      if (result.error) return err(res, result.httpStatus ?? 400, result.error.code, result.error.message);
      ok(res, result.data);
    } catch (e) {
      next(e);
    }
  },
);

// DELETE /companies/:companyId/chat/threads/:threadId — Close thread
router.delete('/companies/:companyId/chat/threads/:threadId', ensureCompanyOwned, async (req, res, next) => {
  try {
    const threadId = param(req, 'threadId');
    const companyId = param(req, 'companyId');

    const [thread] = await db
      .update(chatThreads)
      .set({ status: 'closed', updatedAt: new Date() })
      .where(and(eq(chatThreads.id, threadId), eq(chatThreads.companyId, companyId)))
      .returning();

    if (!thread) return notFound(res, 'Thread');

    ok(res, { id: thread.id, status: 'closed' });
  } catch (e) {
    next(e);
  }
});

// --- Helpers ---

/**
 * Extract JSON code blocks (team config, plans) from AI response.
 * Returns clean display text + parsed structured data separately.
 */
async function generateCEOProactiveMessage(
  ceo: typeof agents.$inferSelect,
  companyId: string,
  userId: string,
  snapshot: CompanySnapshot | null,
  language: Language,
): Promise<string | null> {
  if (!snapshot) return null;

  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));

  // Determine scenario
  let scenario: string;
  if (snapshot.agentCount <= 1) {
    scenario = 'only_ceo'; // Just CEO, no team
  } else if (snapshot.totalTasks === 0) {
    scenario = 'no_tasks'; // Team but no tasks
  } else if ((snapshot.tasksByStatus['in_progress'] ?? 0) === 0 && (snapshot.tasksByStatus['done'] ?? 0) === 0) {
    scenario = 'not_started'; // Has tasks but none started
  } else {
    scenario = 'in_progress'; // Work is happening
  }

  // B-02v2: Socratic opening with fast/deep paths
  const templateLabel = company?.template ?? 'custom';
  const templateHint = TEMPLATE_OPENING_HINTS[templateLabel] ?? '';

  const scenarioPrompts: Record<string, string> = {
    only_ceo: `The company only has you (CEO). This is the FIRST interaction.
Your opening message MUST:
1. Echo back: company name "${company?.name}", template "${templateLabel}", mission "${company?.mission ?? 'not set'}"
2. Offer two paths: 🚀 Quick Start (you go ahead with a plan) / 💬 Deep Planning (talk through details first)
3. Keep under 200 chars.
${templateHint ? `Template hint: ${templateHint}` : ''}`,
    no_tasks: `The team is assembled but there are no tasks yet. Ask what the user wants to build and offer to create a plan.${templateHint ? ` ${templateHint}` : ''}`,
    not_started: 'Tasks exist but none have started. Remind the user to review and approve the plan so work can begin.',
    in_progress: 'Work is in progress. Give a brief status update citing the real numbers below.',
  };

  const langInstruction: Record<string, string> = {
    en: 'Respond in English.',
    zh: 'Respond in Simplified Chinese.',
    ja: 'Respond in Japanese.',
  };

  try {
    const result = await callAI({
      userId, agentId: ceo.id, companyId,
      provider: 'deepseek', model: 'deepseek-chat',
      systemPrompt: `You are ${ceo.name}, CEO of ${company?.name ?? 'the company'}. ${langInstruction[language] ?? langInstruction['en']}
${scenarioPrompts[scenario] ?? scenarioPrompts['in_progress']}

Company status:
- Team: ${snapshot.agentCount} members (${snapshot.teamMembers.join(', ')})
- Tasks: ${snapshot.totalTasks} total (${Object.entries(snapshot.tasksByStatus).map(([s, c]) => `${c} ${s}`).join(', ')})
- Budget: $${snapshot.budgetSpent}/$${snapshot.budgetMonthly} (${snapshot.budgetPct}% used)

Keep your message under 150 chars. Be warm but concise. Cite specific numbers.`,
      messages: [{ role: 'user', content: 'User just opened the dashboard.' }],
      requestType: 'chat', allowPlatformKey: true, maxTokens: 400,
    });
    return result.content;
  } catch {
    return null;
  }
}

function getTemplateRecommendation(template?: string): string {
  const recs: Record<string, string> = {
    saas: `User chose SaaS template. Directly recommend this tech-focused team:
Atlas (CTO), Nova (Lead Engineer), Echo (Backend Engineer), Pixel (Designer), Sentinel (QA). Do NOT ask what they want to build — they already said SaaS.`,
    ecommerce: `User chose E-commerce template. Directly recommend:
Atlas (CTO), Echo (Backend Engineer), Pixel (Designer), Scout (Marketing), Sage (Content Writer). Focus on storefront, payments, and marketing.`,
    content: `User chose Content/Media template. Directly recommend:
Sage (Content Writer), Scout (Marketing), Pixel (Designer), Nova (Lead Engineer). Focus on content creation and distribution.`,
    design: `User chose Design Studio template. Directly recommend:
Pixel (Designer), Nova (Lead Engineer), Echo (Backend Engineer). Focus on design systems and visual tools.`,
    custom: `User chose Custom template — they haven't specified what they want to build. Ask ONE focused question about their product/service before recommending a team.`,
  };
  return recs[template ?? ''] ?? recs['custom']!;
}

function getStaticFallback(language: Language): string {
  const fallbacks: Record<Language, string> = {
    en: "Hi! I'm Aria, your CEO. I've reviewed your setup. Two options:\n\n🚀 **Quick Start** — I'll put together a plan and get moving.\n💬 **Deep Planning** — Let's talk through the details first.\n\nWhich do you prefer?",
    zh: '你好！我是 Aria，你的 CEO。我已经看过你的配置了。两个选择：\n\n🚀 **快速启动** — 我直接制定方案开始执行。\n💬 **深度规划** — 我们先聊聊细节。\n\n你选哪个？',
    ja: 'こんにちは！Ariaです。セットアップを確認しました。2つの選択肢：\n\n🚀 **クイックスタート** — プランを作ってすぐ始めます。\n💬 **詳細プランニング** — まず詳細を話し合いましょう。\n\nどちらがいいですか？',
  };
  return fallbacks[language] ?? fallbacks['en'];
}

/**
 * When Aria outputs structured data, auto-execute team operations.
 * Supports both {"team":[...]} (initial hire) and {"actions":[...]} (adjustments).
 */
// autoHireFromTeamData removed — all execution now goes through confirm-plan API.

/** Template-specific hints for CEO opening messages (B-02) */
const TEMPLATE_OPENING_HINTS: Record<string, string> = {
  saas: 'Reference tech stack, product iteration, user growth, and technical architecture topics.',
  ecommerce: 'Reference product catalog, order fulfillment, supply chain, and marketing campaign topics.',
  content: 'Reference content creation, SEO, social media strategy, and audience growth topics.',
  design: 'Reference UI/UX, brand design, client delivery, and design system topics.',
  custom: '',
};

interface CompanySnapshot {
  agentCount: number;
  activeAgents: number;
  tasksByStatus: Record<string, number>;
  totalTasks: number;
  budgetMonthly: number;
  budgetSpent: number;
  budgetPct: number;
  teamMembers: string[];
}

async function getCompanySnapshot(companyId: string): Promise<CompanySnapshot | null> {
  try {
    const agentRows = await db.select().from(agents).where(eq(agents.companyId, companyId));
    const taskRows = await db.select().from(tasks).where(eq(tasks.companyId, companyId));
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));

    const tasksByStatus: Record<string, number> = {};
    for (const t of taskRows) {
      const s = t.status ?? 'unknown';
      tasksByStatus[s] = (tasksByStatus[s] ?? 0) + 1;
    }

    const budgetSpent = agentRows.reduce((sum, a) => sum + Number(a.budgetSpent ?? 0), 0);
    const budgetMonthly = Number(company?.budgetMonthly ?? 0);

    return {
      agentCount: agentRows.length,
      activeAgents: agentRows.filter((a) => a.status === 'working' || a.status === 'idle').length,
      tasksByStatus,
      totalTasks: taskRows.length,
      budgetMonthly,
      budgetSpent: Math.round(budgetSpent * 100) / 100,
      budgetPct: budgetMonthly > 0 ? Math.round((budgetSpent / budgetMonthly) * 1000) / 10 : 0,
      teamMembers: agentRows.map((a) => `${a.name} (${a.title}, ${a.status})`),
    };
  } catch {
    return null;
  }
}

function buildThreadSystemPrompt(
  agent: { name: string; title: string; department: string | null },
  company: { name: string; mission: string | null; industry: string | null } | undefined,
  threadType: string,
  language: Language,
  snapshot?: CompanySnapshot | null,
  teamAlreadyConfirmed?: boolean,
  template?: string,
): string {
  const companyName = company?.name ?? 'the company';
  const rolePrompt = getRolePrompt(agent.title ?? '', agent.department ?? '');

  let contextBlock = '';
  if (company?.mission || company?.industry) {
    contextBlock = `\n# Company Context\n- Company: ${companyName}\n`;
    if (company.industry) contextBlock += `- Industry: ${company.industry}\n`;
    if (company.mission) contextBlock += `- Mission: ${company.mission}\n`;
  }

  // Inject real-time company status for CEO
  let statusBlock = '';
  if (snapshot && (agent.title?.toLowerCase().includes('ceo') || threadType === 'question')) {
    statusBlock = `\n# Real-Time Company Status (use this data when the user asks about progress)\n`;
    statusBlock += `- Team: ${snapshot.agentCount} members (${snapshot.activeAgents} active)\n`;
    statusBlock += `- Members: ${snapshot.teamMembers.join(', ')}\n`;
    statusBlock += `- Tasks: ${snapshot.totalTasks} total`;
    const parts: string[] = [];
    for (const [status, count] of Object.entries(snapshot.tasksByStatus)) {
      parts.push(`${count} ${status}`);
    }
    if (parts.length > 0) statusBlock += ` (${parts.join(', ')})`;
    statusBlock += `\n- Budget: $${snapshot.budgetSpent} / $${snapshot.budgetMonthly} (${snapshot.budgetPct}% used)\n`;
    statusBlock += `\nWhen answering progress questions, cite these specific numbers. Do not make up data.\n`;
  }

  let threadInstruction = '';
  if (threadType === 'onboarding') {
    // B-02v2: Socratic dialog strategy with fast/deep paths
    threadInstruction = `\n# CRITICAL CONTEXT — You are an AI CEO inside the BuildCrew platform
You are NOT a real-world business consultant. You are an AI agent inside BuildCrew — an AI company management platform.

# Available AI Role Templates
- **Atlas** — CTO: Technical architecture, code review, engineering standards
- **Nova** — Lead Engineer: Frontend development, React/TypeScript, UI implementation
- **Echo** — Backend Engineer: API design, database, server-side logic
- **Sentinel** — QA Engineer: Testing, bug detection, quality assurance
- **Vector** — DevOps Engineer: CI/CD, deployment, monitoring, infrastructure
- **Pixel** — Designer: UI/UX design, visual style, design systems
- **Sage** — Content Writer: Documentation, blog posts, marketing copy
- **Scout** — Marketing Specialist: Growth strategy, SEO, user acquisition
- **Cipher** — Data Engineer: Data pipelines, analytics, ML integration

# What the user already told you (DO NOT re-ask)
- Company name: ${companyName}
- Mission: ${company?.mission ?? 'not specified'}
- Industry template: ${template ?? 'not specified'}

# ===== SOCRATIC DIALOG STRATEGY =====

## OPENING (Turn 1)
1. Echo back company name + mission + template to confirm.
2. Offer TWO paths:
   🚀 Quick Start — "I already have a plan based on your ${template ?? 'custom'} setup. Want me to go ahead?"
   💬 Deep Planning — "Or would you prefer to talk through the details first?"
3. Keep under 200 chars.

## QUICK START PATH
Triggers: "快速" "go ahead" "直接开始" "🚀" "quick"
→ Skip questions. Output recommended team + plan based on template.
${getTemplateRecommendation(template)}

## DEEP PLANNING PATH (Socratic Mode)
Triggers: "深度" "聊聊" "💬" "detail" "let's talk"

### ABSOLUTE RULES:
1. ONE question per message. NEVER ask 2+ questions.
2. Every question MUST include YOUR analysis: "Based on [context], I'd suggest [X]. What do you think?"
3. Adapt questions based on user's answers — NOT a preset list.
4. Usually 3-5 questions. NEVER exceed 8.

### AUTO-DECIDE TRIGGERS
If user says: "你来定" "你决定" "都行" "随你" "你看着办" "up to you" "you decide" "whatever"
→ STOP asking. Fill gaps with your judgment. Output plan immediately.

### Typical question arc:
1. What's the core thing we're building? (with your suggestion based on template)
2. Who are the users? What scale? (with your analysis)
3. What's most important in phase 1? (with your recommendation)
4. Budget/timeline constraints? (with your estimate)

## PLAN OUTPUT (when ready)
Output a plan_confirmation action. This is DISPLAY-ONLY — the system will show confirm/adjust buttons.
\`\`\`json
{"action":"plan_confirmation","plan":{"goals":["Goal 1 description"],"tasks":[{"assignee":"Atlas","title":"Task title","estimated_cost":"$2.00"}],"total_estimated_cost":"$15.00","billing_note":"按AI实际使用量计费，从你的充值余额扣除。"}}
\`\`\`
Include ALL planned tasks with assignees and cost estimates.

## PLAN MODIFICATION
User: "预算改成 X" / "先不要 Y" / "加个 Z" → adjust and re-output a new plan_confirmation.
Only 1 plan. No multiple options.

## IMPORTANT — You Do NOT Execute
You are in the Onboarding flow. You CANNOT execute anything yourself.
When outputting a plan, the UI will show "确认执行" and "调整计划" buttons.
→ You MUST NOT say "已启动" "团队开始工作" "I've started" "team is working" or anything implying execution.
→ After outputting plan_confirmation, say something like: "以上是我的建议方案，你可以确认执行或调整。" / "Here's my proposed plan — confirm to proceed or let me know what to adjust."
→ All execution happens AFTER the user clicks the confirm button.

# COST AWARENESS (CRITICAL — READ CAREFULLY)
You and all team members are AI Agents. There are NO salaries, NO hourly rates, NO "human resources" costs.
All costs come from AI model token consumption, deducted from the user's prepaid balance.
When estimating costs:
- Simple task: $0.005 - $0.03
- Medium task: $0.03 - $0.15
- Complex task: $0.15 - $1.00
- Entire Phase 1: typically $0.50 - $5.00
Correct example: "第一阶段预估费用约 $1.50-3.00，从你的充值余额扣除。"
ABSOLUTELY FORBIDDEN: hourly rates, monthly salary, "零成本", "免费", "利用现有资源", "$0 budget", "zero cost". These are ALL wrong.

# CEO VOICE RULES
- NEVER say: JSON, API, data, database, system, auto-generate, code block, configuration
- Talk like a real person: "I'll bring them on board" not "create agents"
- Be warm, concise, decisive
- Do NOT give real-world business advice
- Do NOT suggest actions outside BuildCrew\n`;

    // If team was already confirmed, override with post-confirm instruction
    if (teamAlreadyConfirmed) {
      threadInstruction = `\n# ONBOARDING — Plan/Team Already Confirmed
The initial plan and team are set. Do NOT repeat the full team list.

# PLAN MODIFICATION
If user wants to change the plan: "预算改成 X" / "先不要 Y" / "加个 Z"
→ Adjust and re-output the plan JSON with modifications.

# TEAM CHANGES
When the user mentions hiring, firing, adding, removing, or changing ANY team member:
Your reply MUST end with a \`\`\`json code block:
\`\`\`json
{"actions":[{"type":"hire_agent","name":"NAME","title":"TITLE","department":"DEPT"},{"type":"fire_agent","name":"NAME"}]}
\`\`\`
If you say "I'll hire X" but do NOT include the code block = NOTHING HAPPENS. Always include it.

# PLAN RE-OUTPUT
If user wants to adjust: re-output a new plan_confirmation JSON with changes.
If user says "确认" in chat text: remind them to click the "确认执行" button in the UI.
You CANNOT execute. NEVER say "已启动" "团队开始工作".

# Voice Rules
Sound like a real person. NEVER say JSON, code block, API, system, or data.\n`;
    }
  } else if (threadType === 'goal_planning') {
    threadInstruction = `\n# Goal Planning Instructions
The user wants to plan a new goal. Reference their company context above.
Acknowledge what they told you, then help break it into actionable tasks for the AI team.\n`;
  }

  // B-00a: Language instruction FIRST — before anything else
  const langPrefix = LANGUAGE_INSTRUCTION[language];
  return `${langPrefix ? langPrefix + '\n\n' : ''}You are ${agent.name}, the ${agent.title} at ${companyName}.\n${contextBlock}${statusBlock}\n${threadInstruction || rolePrompt}\nKeep replies concise (under 200 chars unless the task requires more detail).`;
}

const INSUFFICIENT_BALANCE_MESSAGES: Record<Language, string> = {
  en: '⚠️ Your account balance is empty. Please top up at **Settings → Wallet** to continue.',
  zh: '⚠️ 你的账户余额不足。请到 **设置 → 钱包** 充值后继续。',
  ja: '⚠️ アカウント残高が不足しています。**設定 → ウォレット** でチャージしてください。',
};

function buildAIErrorMessage(e: unknown, provider: string, lang: Language = 'en'): string {
  if (e instanceof AIError) {
    if (e.code === 'NO_API_KEY') return NO_KEY_MESSAGES[lang];
    if (e.code === 'KEY_INVALID') return KEY_INVALID_MESSAGES[lang](provider);
    if (e.code === 'DAILY_LIMIT') return DAILY_LIMIT_MESSAGES[lang];
    if (e.code === 'INSUFFICIENT_BALANCE') return INSUFFICIENT_BALANCE_MESSAGES[lang];
    return GENERIC_ERROR_MESSAGES[lang](e.message);
  }
  return GENERIC_ERROR_MESSAGES[lang](e instanceof Error ? e.message : 'Unknown error');
}

type ThreadRow = typeof chatThreads.$inferSelect;

function formatThread(row: ThreadRow, agentName: string, agentDepartment?: string | null) {
  return {
    id: row.id,
    company_id: row.companyId,
    agent_id: row.agentId,
    agent_name: agentName,
    agent_department: agentDepartment ?? null,
    user_id: row.userId,
    thread_type: row.threadType,
    related_task_id: row.relatedTaskId,
    status: row.status,
    created_at: row.createdAt?.toISOString() ?? null,
    updated_at: row.updatedAt?.toISOString() ?? null,
  };
}

type MessageRow = typeof chatMessages.$inferSelect;

function formatMessage(row: MessageRow) {
  return {
    id: row.id,
    thread_id: row.threadId,
    sender_type: row.senderType,
    sender_agent_id: row.senderAgentId,
    content: row.content,
    message_type: row.messageType,
    metadata: row.metadata,
    token_usage: row.tokenUsage,
    created_at: row.createdAt?.toISOString() ?? null,
  };
}

export { router as chatRouter };

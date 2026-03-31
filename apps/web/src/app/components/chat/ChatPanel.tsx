import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { getApiLocale } from '../../../i18n';
import { extractAction, type ActionData } from '../../../lib/extractAction';
import Markdown from 'react-markdown';
import { X, Send, Check, Edit2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { AgentAvatarVideo } from '../agent/AgentAvatarVideo';
import { Sheet, SheetContent } from '../ui/sheet';
import type { Department } from '../../data/agents';
import { useCompany } from '../../../contexts/CompanyContext';
import { createChatThread, sendChatMessage, getThreadMessages, executePlan } from '../../../lib/api';

/** Strip JSON code blocks from AI messages for display */
function stripJsonCodeBlocks(text: string): string {
  return text.replace(/\n*```(?:json)?\s*\{[\s\S]*?\}\s*```\n*/g, '').trim();
}

/* ---------- Types ---------- */

interface PlanTask {
  title: string;
  agent: string;
  cost: number;
}

interface PlanPhase {
  name: string;
  tasks: PlanTask[];
}

interface PlanData {
  phases: PlanPhase[];
  totalCost: number;
  estimatedDays: number;
}

export interface ChatMessage {
  id: string;
  role: 'agent' | 'user';
  content?: string;
  type: 'text' | 'plan' | 'code';
  time: string;
  plan?: PlanData;
  code?: string;
  planStatus?: 'pending' | 'approved' | 'rejected' | 'modifying';
  metadata?: Record<string, unknown> | null;
  action?: ActionData | null;
}

export interface ChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId?: string;
  agentName?: string;
  agentDepartment?: string;
  /** When true, render inline (no Sheet wrapper) */
  inline?: boolean;
}

/* ---------- Sub-components ---------- */

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-2">
      <div className="flex items-center gap-1 rounded-2xl bg-muted px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block h-2 w-2 rounded-full bg-muted-foreground/60"
            style={{
              animation: 'bounce 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PlanCard({
  message,
  onApprove,
  onModify,
  onReject,
  modifyText,
  onModifyTextChange,
  onModifySubmit,
}: {
  message: ChatMessage;
  onApprove: () => void;
  onModify: () => void;
  onReject: () => void;
  modifyText: string;
  onModifyTextChange: (v: string) => void;
  onModifySubmit: () => void;
}) {
  const { t } = useTranslation();
  const plan = message.plan;
  if (!plan) return null;

  const status = message.planStatus ?? 'pending';

  return (
    <div className="mx-4 my-2 overflow-hidden rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-foreground">{t('chat.implementationPlan')}</span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{plan.estimatedDays}d</span>
          <span>&middot;</span>
          <span>${plan.totalCost.toFixed(2)}</span>
        </div>
      </div>

      {/* Phases */}
      <div className="divide-y divide-border">
        {plan.phases.map((phase) => (
          <div key={phase.name} className="px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">{phase.name}</p>
            <div className="space-y-1.5">
              {phase.tasks.map((task) => (
                <div key={task.title} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                    <span className="text-foreground">{task.title}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{task.agent}</span>
                    <span>${task.cost.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Status / Actions */}
      {status === 'approved' && (
        <div className="flex items-center gap-2 border-t border-border px-4 py-3 text-sm text-green-500">
          <Check className="h-4 w-4" />
          <span>{t('chat.planApproved')}</span>
        </div>
      )}
      {status === 'rejected' && (
        <div className="flex items-center gap-2 border-t border-border px-4 py-3 text-sm text-destructive">
          <XCircle className="h-4 w-4" />
          <span>{t('chat.planRejected')}</span>
        </div>
      )}
      {status === 'modifying' && (
        <div className="border-t border-border p-4">
          <textarea
            className="mb-2 w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            rows={3}
            placeholder={t('chat.modifyPlaceholder')}
            value={modifyText}
            onChange={(e) => onModifyTextChange(e.target.value)}
          />
          <button
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            onClick={onModifySubmit}
          >
            {t('chat.submitModification')}
          </button>
        </div>
      )}
      {status === 'pending' && (
        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <button
            className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
            onClick={onApprove}
          >
            {t('common.approve')}
          </button>
          <button
            className="rounded-lg border border-border px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            onClick={onModify}
          >
            <Edit2 className="mr-1 inline h-3.5 w-3.5" />
            {t('chat.modify')}
          </button>
          <button
            className="rounded-lg bg-destructive px-4 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
            onClick={onReject}
          >
            {t('common.reject')}
          </button>
        </div>
      )}
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="mx-4 my-2 overflow-hidden rounded-xl border border-border">
      <pre className="overflow-x-auto scrollbar-thin bg-[#1e1e2e] p-4 text-sm leading-relaxed text-green-400">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/* ---------- Message list content ---------- */

function ChatMessages({
  messages,
  isTyping,
  agentName,
  agentDepartment,
  onPlanAction,
  modifyText,
  onModifyTextChange,
  onModifySubmit,
  latestReadyMsgId,
  executedPlanId,
  executingPlanId,
  onExecutePlan,
  onAdjustPlan,
}: {
  messages: ChatMessage[];
  isTyping: boolean;
  agentName: string;
  agentDepartment: string;
  onPlanAction: (messageId: string, action: 'approve' | 'modify' | 'reject') => void;
  modifyText: string;
  onModifyTextChange: (v: string) => void;
  onModifySubmit: (messageId: string) => void;
  latestReadyMsgId?: string | null;
  executedPlanId?: string | null;
  executingPlanId?: string | null;
  onExecutePlan?: (msgId: string) => void;
  onAdjustPlan?: () => void;
}) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="py-4">
        {messages.map((msg) => {
          if (msg.type === 'plan') {
            return (
              <PlanCard
                key={msg.id}
                message={msg}
                onApprove={() => onPlanAction(msg.id, 'approve')}
                onModify={() => onPlanAction(msg.id, 'modify')}
                onReject={() => onPlanAction(msg.id, 'reject')}
                modifyText={modifyText}
                onModifyTextChange={onModifyTextChange}
                onModifySubmit={() => onModifySubmit(msg.id)}
              />
            );
          }

          if (msg.type === 'code' && msg.code) {
            return <CodeBlock key={msg.id} code={msg.code} />;
          }

          // Text bubble
          const isAgent = msg.role === 'agent';
          return (
            <div
              key={msg.id}
              className={`flex px-4 py-1.5 ${isAgent ? 'justify-start' : 'justify-end'}`}
            >
              <div className="flex max-w-[85%] items-start gap-2">
                {isAgent && (
                  <AgentAvatarVideo
                    agentName={agentName}
                    department={agentDepartment as Department}
                    status="working"
                    size="xs"
                    showRing={false}
                  />
                )}
                <div>
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      isAgent
                        ? 'bg-muted text-foreground prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2'
                        : 'bg-primary text-primary-foreground whitespace-pre-wrap'
                    }`}
                  >
                    {isAgent ? <Markdown>{stripJsonCodeBlocks(msg.content ?? '')}</Markdown> : msg.content}
                  </div>
                  {/* ready_to_execute action buttons */}
                  {isAgent && msg.action?.type === 'ready_to_execute' && msg.id === latestReadyMsgId && msg.id !== executedPlanId && (
                    <div className="mt-2 flex gap-2">
                      <button
                        className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                        onClick={() => onExecutePlan?.(msg.id)}
                        disabled={!!executingPlanId}
                      >
                        {executingPlanId === msg.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {t('onboarding.executeNow', '立即执行')}
                      </button>
                      <button
                        className="rounded-lg border border-border px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                        onClick={onAdjustPlan}
                        disabled={!!executingPlanId}
                      >
                        {t('onboarding.adjustPlan', '调整计划')}
                      </button>
                    </div>
                  )}
                  {/* executed confirmation */}
                  {isAgent && msg.id === executedPlanId && (
                    <div className="mt-2 flex items-center gap-1.5 text-sm text-green-500">
                      <Check className="h-4 w-4" />
                      <span>{t('onboarding.planExecuted', '已启动执行')}</span>
                    </div>
                  )}
                  <p className={`mt-0.5 text-[10px] text-muted-foreground ${isAgent ? 'text-left' : 'text-right'}`}>
                    {msg.time}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        {isTyping && <TypingIndicator />}
      </div>
    </div>
  );
}

/* ---------- Input bar ---------- */

function ChatInput({ onSend, focusRef }: { onSend: (text: string) => void; focusRef?: React.RefObject<HTMLInputElement | null> }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const resolvedRef = focusRef ?? inputRef;

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    requestAnimationFrame(() => resolvedRef.current?.focus());
  };

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <input
          ref={resolvedRef}
          type="text"
          className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={t('chat.inputPlaceholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          onClick={handleSend}
          disabled={!text.trim()}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------- Inner panel content ---------- */

export function ChatPanelContent({
  agentName = 'Agent',
  agentId,
  agentDepartment = 'executive',
  initialThreadId,
  onClose,
  showHeader = true,
}: {
  agentName?: string;
  agentId?: string;
  agentDepartment?: string;
  /** Pre-existing thread to load messages from */
  initialThreadId?: string;
  onClose?: () => void;
  showHeader?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { currentCompanyId } = useCompany();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [modifyText, setModifyText] = useState('');
  const [threadId, setThreadId] = useState<string | null>(initialThreadId ?? null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [executingPlanId, setExecutingPlanId] = useState<string | null>(null);
  const [executedPlanId, setExecutedPlanId] = useState<string | null>(null);
  const inputFocusRef = useRef<HTMLInputElement>(null);

  // Load existing messages when initialThreadId changes
  useEffect(() => {
    if (!initialThreadId) return;
    // Batch all resets before async work to avoid render-phase warnings
    setThreadId(initialThreadId);
    setMessages([]);
    setSendError(null);
    setLoadingHistory(true);
    let cancelled = false;
    getThreadMessages(currentCompanyId, initialThreadId)
      .then((apiMsgs) => {
        const mapped: ChatMessage[] = apiMsgs.map((m) => {
          const meta = m.metadata ?? null;
          return {
            id: m.id,
            role: m.sender_type === 'user' ? 'user' as const : 'agent' as const,
            content: m.content,
            type: 'text' as const,
            time: new Date(m.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            metadata: meta,
            action: extractAction(m.content, meta),
          };
        });
        if (!cancelled) setMessages(mapped);
      })
      .catch((err) => {
        console.error('Failed to load thread messages:', err);
      })
      .finally(() => { if (!cancelled) setLoadingHistory(false); });
    return () => { cancelled = true; };
  }, [initialThreadId, currentCompanyId]);

  const handleSend = useCallback(
    async (text: string) => {
      const newMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        type: 'text',
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      };
      setMessages((prev) => [...prev, newMsg]);
      setIsTyping(true);
      setSendError(null);

      try {
        let tid = threadId;
        // Create thread on first message if we don't have one
        if (!tid) {
          const threadRes = await createChatThread(
            currentCompanyId,
            agentId ?? '',
            'question',
            text,
            getApiLocale(),
          );
          tid = threadRes.thread.id;
          setThreadId(tid);

          const responseText = threadRes.agent_response?.content;
          if (responseText) {
            const reply: ChatMessage = {
              id: `agent-${Date.now()}`,
              role: 'agent',
              content: responseText,
              type: 'text',
              time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            };
            setMessages((prev) => [...prev, reply]);
          }
          setIsTyping(false);
          return;
        }

        const res = await sendChatMessage(currentCompanyId, tid, text, getApiLocale());
        const responseText = res.agent_response?.content;
        if (responseText) {
          const reply: ChatMessage = {
            id: `agent-${Date.now()}`,
            role: 'agent',
            content: responseText,
            type: 'text',
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          };
          setMessages((prev) => [...prev, reply]);
        }
      } catch (err) {
        console.error('Chat send error:', err);
        setSendError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsTyping(false);
      }
    },
    [threadId, currentCompanyId, agentId, i18n.language],
  );

  // Find latest unexecuted ready_to_execute message
  const latestReadyMsgId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (m.action?.type === 'ready_to_execute') return m.id;
    }
    return null;
  })();

  const handleExecutePlan = useCallback(async (msgId: string) => {
    if (!threadId || executingPlanId) return;
    setExecutingPlanId(msgId);
    try {
      await executePlan(currentCompanyId, threadId, getApiLocale());
      // Nullify ready_to_execute actions immediately so buttons disappear in the current session
      setMessages((prev) =>
        prev.map((m) => (m.action?.type === 'ready_to_execute' ? { ...m, action: null } : m))
      );
      setExecutedPlanId(msgId);
      localStorage.removeItem('bc-read-threads');
      await new Promise((r) => setTimeout(r, 1500));
      navigate('/overview');
    } catch (err) {
      console.error('executePlan failed:', err);
      setSendError(err instanceof Error ? err.message : String(err));
    } finally {
      setExecutingPlanId(null);
    }
  }, [threadId, currentCompanyId, executingPlanId, navigate]);

  const handleAdjustPlanInPanel = useCallback(() => {
    setExecutedPlanId(null);
    // Nullify ready_to_execute actions so old buttons disappear
    setMessages((prev) =>
      prev.map((m) => (m.action?.type === 'ready_to_execute' ? { ...m, action: null } : m))
    );
    requestAnimationFrame(() => inputFocusRef.current?.focus());
  }, []);

  const handlePlanAction = useCallback(
    (messageId: string, action: 'approve' | 'modify' | 'reject') => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;
          if (action === 'approve') return { ...msg, planStatus: 'approved' as const };
          if (action === 'reject') return { ...msg, planStatus: 'rejected' as const };
          return { ...msg, planStatus: 'modifying' as const };
        }),
      );
    },
    [],
  );

  const handleModifySubmit = useCallback(
    (_messageId: string) => {
      if (!modifyText.trim()) return;
      // Add user modification as a message, revert plan to pending
      const newMsg: ChatMessage = {
        id: `mod-${Date.now()}`,
        role: 'user',
        content: modifyText,
        type: 'text',
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      };
      setMessages((prev) => [
        ...prev.map((m) => (m.id === _messageId ? { ...m, planStatus: 'pending' as const } : m)),
        newMsg,
      ]);
      setModifyText('');
    },
    [modifyText],
  );

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <AgentAvatarVideo
              agentName={agentName}
              department={agentDepartment as Department}
              status="working"
              size="sm"
              showRing={false}
            />
            <div>
              <p className="font-semibold text-foreground">{agentName}</p>
              <p className="text-xs text-muted-foreground capitalize">{agentDepartment}</p>
            </div>
          </div>
          {onClose && (
            <button
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      {loadingHistory ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <ChatMessages
          messages={messages}
          isTyping={isTyping}
          agentName={agentName}
          agentDepartment={agentDepartment}
          onPlanAction={handlePlanAction}
          modifyText={modifyText}
          onModifyTextChange={setModifyText}
          onModifySubmit={handleModifySubmit}
          latestReadyMsgId={latestReadyMsgId}
          executedPlanId={executedPlanId}
          executingPlanId={executingPlanId}
          onExecutePlan={handleExecutePlan}
          onAdjustPlan={handleAdjustPlanInPanel}
        />
      )}

      {/* Send error */}
      {sendError && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
          <span className="flex-1 text-destructive">{sendError}</span>
          <button
            className="shrink-0 text-xs text-primary hover:underline"
            onClick={() => setSendError(null)}
          >
            {t('common.dismiss', 'Dismiss')}
          </button>
        </div>
      )}

      {/* Input */}
      <ChatInput onSend={handleSend} focusRef={inputFocusRef} />

      {/* Bounce animation */}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

/* ---------- Main ChatPanel (Sheet wrapper) ---------- */

export function ChatPanel({
  open,
  onOpenChange,
  agentId,
  agentName,
  agentDepartment,
  inline,
}: ChatPanelProps) {
  if (inline) {
    return (
      <ChatPanelContent
        agentId={agentId}
        agentName={agentName}
        agentDepartment={agentDepartment}
      />
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] p-0 sm:max-w-[480px] [&>button]:hidden">
        <ChatPanelContent
          agentId={agentId}
          agentName={agentName}
          agentDepartment={agentDepartment}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

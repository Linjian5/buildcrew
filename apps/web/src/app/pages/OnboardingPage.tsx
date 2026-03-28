import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getApiLocale } from '../../i18n';
import { extractAction, type ActionData } from '../../lib/extractAction';
import Markdown from 'react-markdown';
import {
  Rocket,
  ShoppingCart,
  FileText,
  Palette,
  Zap,
  ArrowLeft,
  Send,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import {
  createCompanyViaApi,
  updateCompany,
  deleteCompany,
  getAgents,
  createChatThread,
  sendChatMessage,
  getThreadMessages,
  confirmPlan,
  executePlan,
} from '../../lib/api';
import { AgentAvatarVideo } from '../components/agent/AgentAvatarVideo';
import type { Agent } from '@buildcrew/shared';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
  streaming?: boolean;
  hasPlan?: boolean;
  action?: ActionData | null;
}

/* ------------------------------------------------------------------ */
/*  Template definitions                                               */
/* ------------------------------------------------------------------ */

interface TemplateDef {
  id: string;
  i18nKey: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  /** Warm background tint when selected */
  selectedBg: string;
}

const templateDefs: TemplateDef[] = [
  { id: 'saas', i18nKey: 'saas', icon: Rocket, color: '#3B82F6', selectedBg: 'rgba(59,130,246,0.08)' },
  { id: 'ecommerce', i18nKey: 'ecommerce', icon: ShoppingCart, color: '#F59E0B', selectedBg: 'rgba(245,158,11,0.08)' },
  { id: 'content', i18nKey: 'content', icon: FileText, color: '#10B981', selectedBg: 'rgba(16,185,129,0.08)' },
  { id: 'design', i18nKey: 'design', icon: Palette, color: '#EC4899', selectedBg: 'rgba(236,72,153,0.08)' },
  { id: 'custom', i18nKey: 'custom', icon: Zap, color: '#8B5CF6', selectedBg: 'rgba(139,92,246,0.08)' },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Strip JSON code blocks from message content for display.
 * Removes ```json...``` blocks so users see only natural language.
 */
function stripJsonCodeBlocks(text: string): string {
  return text.replace(/\n*```(?:json)?\s*\{[\s\S]*?\}\s*```\n*/g, '').trim();
}

/* ------------------------------------------------------------------ */
/*  CeoChatStep                                                        */
/* ------------------------------------------------------------------ */

interface CeoChatStepProps {
  companyName: string;
  mission: string;
  templateId: string;
  existingCompanyId: string | null;
  onCompanyCreated: (id: string) => void;
  onBack: () => void;
}

function CeoChatStep({
  companyName,
  mission,
  templateId,
  existingCompanyId,
  onCompanyCreated,
  onBack,
}: CeoChatStepProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { switchCompany } = useCompany();

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [confirmedPlanId, setConfirmedPlanId] = useState<string | null>(null);
  // showPlanActions removed — buttons now controlled by roundCount >= 1
  const [roundCount, setRoundCount] = useState(0);
  const [ceoAgent, setCeoAgent] = useState<Agent | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(existingCompanyId);
  const [initError, setInitError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, showTyping, scrollToBottom]);

  /* Stream a string char-by-char into a message */
  const streamText = useCallback(
    (msgId: string, fullText: string, onDone?: () => void) => {
      let idx = 0;
      const iv = setInterval(() => {
        idx += 2;
        const partial = fullText.slice(0, idx);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, content: partial, streaming: idx < fullText.length } : m,
          ),
        );
        if (idx >= fullText.length) {
          clearInterval(iv);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId ? { ...m, content: fullText, streaming: false } : m,
            ),
          );
          onDone?.();
        }
      }, 15);
      return () => clearInterval(iv);
    },
    [],
  );

  /* Initialise: show welcome, create company, get CEO, create thread */
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // Show instant welcome message from Aria (frontend-only, no API wait)
    const welcomeText = t('onboarding.ceoWelcome', { company: companyName });
    setMessages([
      { id: uid(), role: 'assistant', content: welcomeText, time: now() },
    ]);
    setShowTyping(true);

    (async () => {
      try {
        // 1. Create or update company
        let cId = existingCompanyId;
        if (cId) {
          // Company already exists — update name/mission if changed
          await updateCompany(cId, {
            name: companyName,
            mission,
            industry: templateId !== 'custom' ? templateId : undefined,
          }).catch(() => { /* ignore update errors */ });
          switchCompany(cId, companyName);
        } else {
          const company = await createCompanyViaApi({
            name: companyName,
            mission,
            industry: templateId !== 'custom' ? templateId : undefined,
          });
          cId = company.id;
          onCompanyCreated(cId);
          switchCompany(cId, companyName);
        }
        setCompanyId(cId);

        // 2. Get CEO agent
        const agents = await getAgents(cId);
        const ceo = agents.find(
          (a) =>
            a.title.toLowerCase().includes('ceo') ||
            a.department === 'executive' ||
            a.name.toLowerCase() === 'aria',
        );
        if (ceo) setCeoAgent(ceo);

        // 3. Create chat thread with greeting
        const greetingMsg = t('onboarding.ceoGreeting', {
          company: companyName,
          mission,
        });
        const threadRes = await createChatThread(
          cId,
          ceo?.id ?? agents[0]?.id ?? '',
          'onboarding',
          greetingMsg,
          getApiLocale(),
          templateId,
        );
        setThreadId(threadRes.thread.id);
        setShowTyping(false);

        // Stream the agent response if available
        const responseText = threadRes.agent_response?.content;
        if (responseText) {
          const responseId = uid();
          const action = extractAction(responseText, threadRes.agent_response?.metadata);
          setMessages((prev) => [
            ...prev,
            { id: responseId, role: 'assistant', content: '', time: now(), streaming: true, action },
          ]);
          streamText(responseId, responseText);
        }
      } catch (err) {
        console.error('Onboarding init error:', err);
        setShowTyping(false);
        setInitError(err instanceof Error ? err.message : String(err));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  /* Send a user message */
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !companyId || !threadId) return;

    setSending(true);
    setInput('');
    setRoundCount((c) => c + 1);

    const userMsg: ChatMsg = { id: uid(), role: 'user', content: text, time: now() };
    setMessages((prev) => [...prev, userMsg]);
    setShowTyping(true);

    try {
      const res = await sendChatMessage(companyId, threadId, text, getApiLocale());
      const responseText = res.agent_response?.content;
      if (!responseText) throw new Error('No AI response received');

      const responseId = uid();
      const action = extractAction(responseText, res.agent_response?.metadata);
      setMessages((prev) => [
        ...prev,
        { id: responseId, role: 'assistant', content: '', time: now(), streaming: true, action },
      ]);
      setShowTyping(false);
      streamText(responseId, responseText);
    } catch (err) {
      console.error('Send message error:', err);
      setShowTyping(false);
      setSendError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [input, sending, companyId, threadId, i18n.language, t, streamText]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const [launching, setLaunching] = useState(false);
  const [launchStatus, setLaunchStatus] = useState<'idle' | 'confirming' | 'executing' | 'success' | 'error'>('idle');

  /**
   * handleLaunch — calls confirmPlan, lets backend decide what to do.
   *
   * Backend returns:
   *   { status: 'ready' }     → Aria sends a ready_to_execute message; user clicks "立即执行"
   *   { status: 'need_info' } → Aria asks for missing info; user continues chatting
   */
  const handleLaunch = async () => {
    if (!companyId || !threadId) return;
    setLaunching(true);
    setLaunchStatus('confirming');
    setShowTyping(true);

    try {
      const result = await confirmPlan(companyId, threadId, getApiLocale());

      // confirmPlan triggers Aria to send a message as a side-effect.
      // Fetch the latest messages to get Aria's reply.
      const apiMsgs = await getThreadMessages(companyId, threadId);
      const lastAgentMsg = [...apiMsgs].reverse().find((m) => m.sender_type !== 'user');
      const responseText = lastAgentMsg?.content;

      if (responseText) {
        // Only show if we don't already have this message displayed
        const alreadyShown = messages.some((m) => m.content === responseText);
        if (!alreadyShown) {
          const responseId = uid();
          const action = extractAction(responseText, lastAgentMsg?.metadata);
          setMessages((prev) => [
            ...prev,
            { id: responseId, role: 'assistant', content: '', time: now(), streaming: true, action },
          ]);
          setShowTyping(false);
          streamText(responseId, responseText);
        } else {
          setShowTyping(false);
        }
      } else {
        setShowTyping(false);
      }

      // Both scenarios: return to idle, let user interact
      // ready → "立即执行" button appears on the ready_to_execute message
      // need_info → user continues chatting, clicks "启动" again later
      void result;
      setLaunchStatus('idle');
    } catch (err) {
      console.error('confirmPlan failed:', err);
      setShowTyping(false);
      setLaunchStatus('error');
    } finally {
      setLaunching(false);
    }
  };

  /**
   * handleExecute — triggered by the "立即执行" button on a ready_to_execute message.
   * Calls the execute endpoint to start the work loop, then navigates to overview.
   */
  const handleExecute = async () => {
    if (!companyId || !threadId) return;
    setLaunching(true);
    setLaunchStatus('executing');
    switchCompany(companyId, companyName);

    try {
      await executePlan(companyId, threadId, getApiLocale());
      setLaunchStatus('success');
      localStorage.removeItem('bc-read-threads');
      await new Promise((r) => setTimeout(r, 2000));
      navigate('/overview');
    } catch (err) {
      console.error('executePlan failed:', err);
      setLaunchStatus('error');
      setLaunching(false);
    }
  };

  // Find the latest ready_to_execute message (for inline "立即执行" button)
  const latestReadyMsgId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (m.action?.type === 'ready_to_execute') return m.id;
    }
    return null;
  })();

  const handleAdjustPlan = () => {
    // Clear confirmed/ready state so old buttons disappear and "启动" reappears
    setConfirmedPlanId(null);
    setLaunchStatus('idle');
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.map((msg) => {
            const isReadyToExecute = msg.action?.type === 'ready_to_execute';
            const isLatestReady = isReadyToExecute && msg.id === latestReadyMsgId;
            const isExecuted = isReadyToExecute && msg.id === confirmedPlanId;
            const showButtons = isLatestReady && !isExecuted && !msg.streaming && launchStatus === 'idle';

            return (
              <div key={msg.id}>
                <div
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="shrink-0">
                      {ceoAgent ? (
                        <AgentAvatarVideo
                          agentName={ceoAgent.name}
                          department={typeof ceoAgent.department === 'string' ? ceoAgent.department as 'executive' : ceoAgent.department}
                          status="working"
                          size="sm"
                          showRing={false}
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                          AI
                        </div>
                      )}
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground whitespace-pre-wrap'
                        : 'bg-muted text-foreground prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2'
                    }`}
                  >
                    {msg.role === 'assistant' ? <Markdown>{stripJsonCodeBlocks(msg.content)}</Markdown> : msg.content}
                    {msg.streaming && (
                      <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current" />
                    )}
                  </div>
                </div>

                {/* Execute buttons for ready_to_execute messages */}
                {isExecuted && (
                  <div className="ml-13 mt-2 text-sm text-emerald-500 font-medium">
                    ✅ {t('onboarding.planExecuted', '已启动执行')}
                  </div>
                )}
                {showButtons && (
                  <div className="ml-13 mt-2 flex gap-2">
                    <button
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                      onClick={() => {
                        setConfirmedPlanId(msg.id);
                        void handleExecute();
                      }}
                      disabled={launching}
                    >
                      {launching && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {t('onboarding.executeNow', '立即执行')}
                    </button>
                    <button
                      className="rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
                      onClick={handleAdjustPlan}
                    >
                      {t('onboarding.adjustPlan', '调整计划')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Plan action buttons — show after 1+ user messages, hide when ready_to_execute is showing */}
          {roundCount >= 1 && launchStatus === 'idle' && !showTyping && !sending && !latestReadyMsgId && (
            <div className="flex flex-wrap gap-2 pl-13">
              <button
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                onClick={() => void handleLaunch()}
                disabled={launching}
              >
                {t('onboarding.launch')}
              </button>
              <button
                className="rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
                onClick={() => {
                  inputRef.current?.focus();
                }}
              >
                {t('onboarding.adjustPlan', 'Adjust plan')}
              </button>
            </div>
          )}

          {/* Launch status feedback */}
          {(launchStatus === 'confirming' || launchStatus === 'executing') && (
            <div className="mx-auto flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-5 py-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm font-medium text-primary">
                {launchStatus === 'confirming'
                  ? t('onboarding.confirming', '正在分析你的计划...')
                  : t('onboarding.executing', '正在启动你的团队...')}
              </span>
            </div>
          )}
          {launchStatus === 'success' && (
            <div className="mx-auto flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-3">
              <span className="text-lg">✅</span>
              <span className="text-sm font-medium text-emerald-500">{t('onboarding.teamReady', 'Team assembled! Redirecting...')}</span>
            </div>
          )}
          {launchStatus === 'error' && (
            <div className="mx-auto flex flex-col items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-3">
              <span className="text-sm text-destructive">{t('onboarding.hireFailed', 'Failed to create team. Please try again.')}</span>
              <button className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground" onClick={() => { setLaunchStatus('idle'); }}>
                {t('common.retry', 'Retry')}
              </button>
            </div>
          )}

          {/* Typing indicator */}
          {showTyping && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Aria is typing…</span>
            </div>
          )}

          {/* Init error */}
          {initError && (
            <div className="mx-auto max-w-sm rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-center text-sm">
              <p className="text-destructive">{t('onboarding.aiError', 'Failed to connect to AI')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('onboarding.aiErrorDetail', 'Please check your connection or try again later')}</p>
              <button
                className="mt-2 rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                onClick={() => { setInitError(null); initRef.current = false; setMessages([]); setRetryKey((k) => k + 1); }}
              >
                {t('common.retry', 'Retry')}
              </button>
            </div>
          )}

          {/* Send error */}
          {sendError && (
            <div className="mx-auto max-w-sm rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-center text-sm">
              <p className="text-destructive">{t('onboarding.aiError', 'Failed to connect to AI')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('onboarding.aiErrorDetail', 'Please check your connection or try again later')}</p>
              <button
                className="mt-2 rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                onClick={() => setSendError(null)}
              >
                {t('common.dismiss', 'Dismiss')}
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <input
            ref={inputRef}
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder={t('onboarding.chatPlaceholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
          />
          <button
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            onClick={handleSend}
            disabled={!input.trim() || sending}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between border-t border-border bg-background px-4 py-2">
        <button
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => {
            // Delete company created during this Step 2 visit
            if (companyId) {
              deleteCompany(companyId).catch(() => {});
              switchCompany('', '');
            }
            onBack();
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </button>
        <span className="text-xs text-muted-foreground">
          {companyName} {mission ? `· ${mission}` : ''}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  OnboardingPage (main export)                                       */
/* ------------------------------------------------------------------ */

export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState('');
  const [mission, setMission] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [createdCompanyId, setCreatedCompanyId] = useState<string | null>(null);

  // Guard: redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const [showValidation, setShowValidation] = useState(false);
  const canProceed = companyName.trim().length > 0 && mission.trim().length > 0 && selectedTemplate !== null;

  const handleNext = () => {
    if (!canProceed) {
      setShowValidation(true);
      return;
    }
    setShowValidation(false);
    setStep(2);
  };

  /* ---- Step 1 & Step 2 ---- */
  return step === 1 ? (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-5xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              {t('onboarding.buildYour')}{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(90deg, #06B6D4, #10B981)' }}
              >
                {t('onboarding.aiCompany')}
              </span>
            </h1>
            <p className="mt-2 text-muted-foreground">{t('onboarding.step1Title')}</p>
          </div>

          <div
            className="rounded-2xl border border-border bg-card p-8 shadow-lg"
            style={{ minHeight: '60vh' }}
          >
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {/* Left column: inputs */}
              <div className="flex flex-col gap-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t('onboarding.companyName')}
                  </label>
                  <input
                    className={`w-full rounded-lg border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                      showValidation && !companyName.trim() ? 'border-destructive' : 'border-border'
                    }`}
                    placeholder={t('onboarding.companyNamePlaceholder')}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t('onboarding.mission')}
                  </label>
                  <textarea
                    className={`w-full resize-none rounded-lg border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                      showValidation && !mission.trim() ? 'border-destructive' : 'border-border'
                    }`}
                    placeholder={t('onboarding.missionPlaceholder')}
                    rows={4}
                    value={mission}
                    onChange={(e) => setMission(e.target.value)}
                  />
                </div>

                <div className="mt-auto flex flex-col gap-3 pt-4">
                  <button
                    className={`w-full rounded-lg px-6 py-3 font-medium transition-colors ${
                      canProceed
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    }`}
                    onClick={handleNext}
                  >
                    {t('common.next')}
                  </button>
                  <button
                    className="text-sm text-muted-foreground underline transition-colors hover:text-foreground"
                    onClick={() => navigate('/overview')}
                  >
                    {t('onboarding.skip')}
                  </button>
                </div>
              </div>

              {/* Right column: template cards */}
              <div>
                <h3 className={`mb-4 text-sm font-medium ${showValidation && !selectedTemplate ? 'text-destructive' : 'text-foreground'}`}>
                  {t('onboarding.chooseTemplate')}
                  {showValidation && !selectedTemplate && <span className="ml-1 text-xs">*</span>}
                </h3>
                <div className={`grid grid-cols-2 gap-3 rounded-lg ${showValidation && !selectedTemplate ? 'ring-2 ring-destructive/50 p-1' : ''}`}>
                  {templateDefs.map((tmpl) => {
                    const Icon = tmpl.icon;
                    const isSelected = selectedTemplate === tmpl.id;
                    return (
                      <button
                        key={tmpl.id}
                        className={`relative flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                          isSelected
                            ? 'border-cyan-500/60 shadow-lg'
                            : 'border-border bg-card hover:border-muted-foreground/30'
                        }`}
                        style={
                          isSelected
                            ? {
                                backgroundColor: tmpl.selectedBg,
                                boxShadow: `0 0 24px ${tmpl.color}20, inset 0 1px 0 rgba(255,255,255,0.05)`,
                              }
                            : undefined
                        }
                        onClick={() =>
                          setSelectedTemplate(isSelected ? null : tmpl.id)
                        }
                      >
                        {/* Selected indicator dot */}
                        {isSelected && (
                          <span
                            className="absolute right-3 top-3 h-3 w-3 rounded-full"
                            style={{ backgroundColor: tmpl.color }}
                          />
                        )}
                        {/* Icon in dark rounded square */}
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg"
                          style={{
                            backgroundColor: isSelected ? `${tmpl.color}20` : 'rgba(255,255,255,0.06)',
                          }}
                        >
                          <span style={{ color: isSelected ? tmpl.color : undefined }}>
                            <Icon className={`h-5 w-5 ${isSelected ? '' : 'text-muted-foreground'}`} />
                          </span>
                        </div>
                        <div>
                          <span
                            className={`text-sm font-semibold ${
                              isSelected ? 'text-foreground' : 'text-foreground/80'
                            }`}
                          >
                            {t(`onboarding.templates.${tmpl.i18nKey}.name`)}
                          </span>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                            {t(`onboarding.templates.${tmpl.i18nKey}.description`)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  ) : (
    <div className="flex h-screen flex-col bg-background">
      {/* Top progress bar */}
      <div className="shrink-0 border-b border-border/50 px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-xs text-muted-foreground">Step 2 of 2</span>
          <span className="text-xs font-semibold text-primary">{t('onboarding.goalPlanning')}</span>
        </div>
        <div className="mx-auto mt-2 max-w-5xl">
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: '100%', background: 'linear-gradient(90deg, #3B82F6, #10B981)' }} />
          </div>
        </div>
      </div>

      {/* Centered card container */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        <div className="mx-auto flex min-h-full max-w-5xl flex-col justify-center px-6 py-4">
          <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden" style={{ minHeight: '60vh' }}>
            <CeoChatStep
              companyName={companyName}
              mission={mission}
              templateId={selectedTemplate ?? 'custom'}
              existingCompanyId={createdCompanyId}
              onCompanyCreated={setCreatedCompanyId}
              onBack={() => { setCreatedCompanyId(null); setStep(1); }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

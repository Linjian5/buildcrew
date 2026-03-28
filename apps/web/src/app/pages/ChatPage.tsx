import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiLocale } from '../../i18n';
import { useSearchParams } from 'react-router';
import { Loader2, AlertCircle } from 'lucide-react';
import { AgentAvatarVideo } from '../components/agent/AgentAvatarVideo';
import { ChatPanelContent } from '../components/chat/ChatPanel';
import { PageContainer } from '../components/layout/PageContainer';
import { useCompany } from '../../contexts/CompanyContext';
import { useChat } from '../../contexts/ChatContext';
import { getChatThreads, createChatThread, getActiveThread, type ChatThread } from '../../lib/api';
import type { Department } from '../data/agents';

interface Conversation {
  id: string;
  agentId: string;
  agentName: string;
  agentDepartment: Department;
  lastMessage: string;
  time: string;
  unread: number;
  section: 'needs-answer' | 'active' | 'completed';
}

/* ---------- Sidebar ---------- */

function ConversationRow({
  conversation,
  selected,
  onClick,
}: {
  conversation: Conversation;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
        selected ? 'bg-primary/10 text-foreground' : 'text-foreground hover:bg-muted'
      }`}
      onClick={onClick}
    >
      <AgentAvatarVideo
        agentName={conversation.agentName}
        department={conversation.agentDepartment}
        status="working"
        size="xs"
        showRing={false}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{conversation.agentName}</span>
          <span className="text-[10px] text-muted-foreground">{conversation.time}</span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{conversation.lastMessage}</p>
      </div>
      {conversation.unread > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
          {conversation.unread}
        </span>
      )}
    </button>
  );
}

function ConversationSidebar({
  conversations,
  selectedId,
  onSelect,
}: {
  conversations: Conversation[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();

  const needsAnswer = conversations.filter((c) => c.section === 'needs-answer');
  const active = conversations.filter((c) => c.section === 'active');
  const completed = conversations.filter((c) => c.section === 'completed');

  const renderSection = (label: string, items: Conversation[], highlight?: boolean) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-2">
        <p
          className={`mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider ${
            highlight ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          {label}
        </p>
        {items.map((c) => (
          <ConversationRow
            key={c.id}
            conversation={c}
            selected={c.id === selectedId}
            onClick={() => onSelect(c.id)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{t('chat.conversations')}</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <p className="text-sm font-medium text-muted-foreground">{t('empty.noConversations')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('empty.noConversationsDesc')}</p>
          </div>
        )}
        {renderSection(t('chat.needsYourAnswer'), needsAnswer, true)}
        {renderSection(t('chat.activeChats'), active)}
        {renderSection(t('chat.completedChats'), completed)}
      </div>
    </div>
  );
}

/* ---------- ChatPage ---------- */

function mapThreadToConversation(thread: ChatThread): Conversation {
  return {
    id: thread.id,
    agentId: thread.agent_id,
    agentName: thread.agent_name || 'Agent',
    agentDepartment: (thread.agent_department ?? 'executive') as Department,
    lastMessage: '',
    time: new Date(thread.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    unread: 0,
    section: thread.status === 'completed' ? 'completed' : 'active',
  };
}

export function ChatPage() {
  const { t } = useTranslation();
  const { currentCompanyId, validating } = useCompany();
  const { markAllRead } = useChat();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Read agent param from URL
  const agentIdParam = searchParams.get('agent');
  const agentNameParam = searchParams.get('name') ?? 'Agent';

  // Load threads and handle ?agent= param
  useEffect(() => {
    if (validating) return; // wait for company context to finish validating
    if (!currentCompanyId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch threads + active CEO thread in parallel
        const [threads, activeRes] = await Promise.all([
          getChatThreads(currentCompanyId),
          getActiveThread(currentCompanyId).catch(() => null),
        ]);
        if (cancelled) return;

        const mapped = threads.map(mapThreadToConversation);

        // Apply persisted read state
        const readThreads = new Set<string>(
          JSON.parse(localStorage.getItem('bc-read-threads') || '[]') as string[],
        );

        // Merge active CEO thread: mark as unread + needs-answer if not already read
        if (activeRes?.thread) {
          const ceoThreadId = activeRes.thread.id;
          const isRead = readThreads.has(ceoThreadId);
          const existing = mapped.find((c) => c.id === ceoThreadId);
          const lastMsg = activeRes.messages[activeRes.messages.length - 1];

          if (existing) {
            if (lastMsg) existing.lastMessage = lastMsg.content.replace(/[#*`\n]/g, ' ').slice(0, 50);
            if (!isRead) {
              const hasAgentMsg = activeRes.messages.some((m) => m.sender_type !== 'user');
              if (hasAgentMsg) {
                existing.unread = 1;
                existing.section = 'needs-answer';
              }
            }
          } else {
            const ceoConv = mapThreadToConversation(activeRes.thread);
            if (lastMsg) ceoConv.lastMessage = lastMsg.content.replace(/[#*`\n]/g, ' ').slice(0, 50);
            if (!isRead) {
              ceoConv.section = 'needs-answer';
              ceoConv.unread = 1;
            }
            mapped.unshift(ceoConv);
          }
        }

        setConversations(mapped);

        if (agentIdParam) {
          // Find existing thread for this agent
          const existingAgent = mapped.find((c) => c.agentId === agentIdParam);
          if (existingAgent) {
            setSelectedId(existingAgent.id);
          } else {
            // Create new thread
            try {
              const threadRes = await createChatThread(
                currentCompanyId,
                agentIdParam,
                'question',
                undefined,
                getApiLocale(),
              );
              if (cancelled) return;
              const newConv = mapThreadToConversation({
                ...threadRes.thread,
                agent_name: agentNameParam,
              });
              setConversations((prev) => [newConv, ...prev]);
              setSelectedId(newConv.id);
            } catch (err) {
              console.error('Failed to create thread for agent:', err);
            }
          }
          // Clean URL params after handling
          setSearchParams({}, { replace: true });
        } else if (activeRes?.thread) {
          // Auto-select CEO active thread and mark as read
          const ceoId = activeRes.thread.id;
          setSelectedId(ceoId);
          setConversations((prev) =>
            prev.map((c) => c.id === ceoId ? { ...c, unread: 0, section: c.section === 'needs-answer' ? 'active' : c.section } : c),
          );
        } else if (mapped.length > 0) {
          setSelectedId((prev) => prev || mapped[0]!.id);
        }
      } catch (err) {
        console.error('Failed to load conversations:', err);
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompanyId, validating, agentIdParam]);

  // Mark conversation as read when selected
  const handleSelect = (id: string) => {
    setSelectedId(id);
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === id ? { ...c, unread: 0, section: c.section === 'needs-answer' ? 'active' as const : c.section } : c,
      );
      // Update top bar: if no more unread, clear red dot
      const totalUnread = updated.reduce((sum, c) => sum + c.unread, 0);
      if (totalUnread === 0) markAllRead();
      return updated;
    });
    // Persist read state
    try {
      const readSet = JSON.parse(localStorage.getItem('bc-read-threads') || '[]') as string[];
      if (!readSet.includes(id)) {
        readSet.push(id);
        localStorage.setItem('bc-read-threads', JSON.stringify(readSet));
      }
    } catch { /* ignore */ }
  };

  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <PageContainer>
      <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-xl border border-border bg-card">
        <ConversationSidebar
          conversations={conversations}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
        <div className="flex-1">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center px-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <button
                className="mt-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
                onClick={() => { setError(null); setLoading(true); window.location.reload(); }}
              >
                {t('common.retry', 'Retry')}
              </button>
            </div>
          ) : selected ? (
            <ChatPanelContent
              key={selected.id}
              agentId={selected.agentId}
              agentName={selected.agentName}
              agentDepartment={selected.agentDepartment}
              initialThreadId={selected.id}
              showHeader={true}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {conversations.length === 0
                ? t('empty.noConversations', 'No conversations yet')
                : t('chat.selectConversation')}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

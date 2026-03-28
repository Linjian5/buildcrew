import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { getActiveThread, getChatThreads } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';
import type { WsEventType } from '../types';

const STORAGE_KEY = 'bc-unread-threads';

/** Read per-thread unread counts from localStorage */
function loadUnread(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

function saveUnread(map: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

interface ChatContextValue {
  openChat: (agentId: string, agentName: string, agentDepartment: string) => void;
  closeChat: () => void;
  /** Mark a specific thread as read, reducing unreadCount */
  markThreadRead: (threadId: string) => void;
  /** Legacy: mark all as read */
  markAllRead: () => void;
  /** Increment unread for a thread (called externally or from WS) */
  incrementUnread: (threadId: string) => void;
  chatOpen: boolean;
  chatAgentId: string | null;
  chatAgentName: string | null;
  chatAgentDepartment: string | null;
  /** Total unread message count across all threads */
  unreadCount: number;
  ceoAgentId: string | null;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatAgentId, setChatAgentId] = useState<string | null>(null);
  const [chatAgentName, setChatAgentName] = useState<string | null>(null);
  const [chatAgentDepartment, setChatAgentDepartment] = useState<string | null>(null);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>(loadUnread);
  const [ceoAgentId, setCeoAgentId] = useState<string | null>(null);
  const unreadMapRef = useRef(unreadMap);
  unreadMapRef.current = unreadMap;

  const companyId = localStorage.getItem('bc-company-id') ?? '';
  const token = localStorage.getItem('buildcrew_token') ?? '';

  // Total unread count
  const unreadCount = Object.values(unreadMap).reduce((sum, n) => sum + n, 0);

  // Persist to localStorage whenever unreadMap changes
  useEffect(() => {
    saveUnread(unreadMap);
  }, [unreadMap]);

  // Load initial unread state from backend
  useEffect(() => {
    if (!companyId || !token) return;

    // Get CEO agent id and check for unread messages
    getActiveThread(companyId)
      .then((res) => {
        if (res.thread) {
          setCeoAgentId(res.thread.agent_id);
          const readThreads = new Set<string>(
            JSON.parse(localStorage.getItem('bc-read-threads') || '[]') as string[],
          );
          const isRead = readThreads.has(res.thread.id);
          const agentMsgCount = res.messages.filter((m) => m.sender_type !== 'user').length;
          if (agentMsgCount > 0 && !isRead) {
            setUnreadMap((prev) => ({ ...prev, [res.thread!.id]: (prev[res.thread!.id] ?? 0) || 1 }));
          }
        }
      })
      .catch(() => { /* ignore */ });

    // Also check all threads for unread
    getChatThreads(companyId)
      .then((threads) => {
        const readThreads = new Set<string>(
          JSON.parse(localStorage.getItem('bc-read-threads') || '[]') as string[],
        );
        const newUnread: Record<string, number> = {};
        for (const thread of threads) {
          if (!readThreads.has(thread.id) && thread.updated_at) {
            // Thread has activity and hasn't been read
            newUnread[thread.id] = (unreadMapRef.current[thread.id] ?? 0) || 1;
          }
        }
        if (Object.keys(newUnread).length > 0) {
          setUnreadMap((prev) => ({ ...prev, ...newUnread }));
        }
      })
      .catch(() => { /* ignore */ });
  }, [companyId, token]);

  // WebSocket: listen for agent.message events
  const ws = useWebSocket({
    companyId,
    token,
  });

  useEffect(() => {
    if (!companyId) return;
    const unsub = ws.subscribe('agent.message' as WsEventType, (data: unknown) => {
      const d = data as { thread_id?: string; agent_id?: string };
      if (d.thread_id) {
        setUnreadMap((prev) => ({
          ...prev,
          [d.thread_id!]: (prev[d.thread_id!] ?? 0) + 1,
        }));
      }
    });
    return unsub;
  }, [companyId, ws]);

  const incrementUnread = useCallback((threadId: string) => {
    setUnreadMap((prev) => ({
      ...prev,
      [threadId]: (prev[threadId] ?? 0) + 1,
    }));
  }, []);

  const markThreadRead = useCallback((threadId: string) => {
    setUnreadMap((prev) => {
      const next = { ...prev };
      delete next[threadId];
      return next;
    });
    // Also update bc-read-threads
    const readThreads = new Set<string>(
      JSON.parse(localStorage.getItem('bc-read-threads') || '[]') as string[],
    );
    readThreads.add(threadId);
    localStorage.setItem('bc-read-threads', JSON.stringify([...readThreads]));
  }, []);

  const markAllRead = useCallback(() => {
    setUnreadMap({});
  }, []);

  const openChat = useCallback((agentId: string, agentName: string, agentDepartment: string) => {
    setChatAgentId(agentId);
    setChatAgentName(agentName);
    setChatAgentDepartment(agentDepartment);
    setChatOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setChatOpen(false);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        openChat,
        closeChat,
        markThreadRead,
        markAllRead,
        incrementUnread,
        chatOpen,
        chatAgentId,
        chatAgentName,
        chatAgentDepartment,
        unreadCount,
        ceoAgentId,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return ctx;
}

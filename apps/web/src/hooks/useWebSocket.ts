import { useEffect, useRef, useCallback, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { WsEventType, WsMessage } from '../types';
import { env } from '../lib/env';

interface UseWebSocketOptions {
  companyId: string;
  token: string;
  /** Max reconnection attempts. Default: 3 */
  maxRetries?: number;
  /** Global message handler */
  onMessage?: (message: WsMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

interface UseWebSocketReturn {
  connected: boolean;
  lastMessage: WsMessage | null;
  /** Seconds since last heartbeat, null if no heartbeat received */
  heartbeatAgo: number | null;
  /** Subscribe to a specific event type. Returns unsubscribe function. */
  subscribe: (event: WsEventType, handler: (data: unknown) => void) => () => void;
}

const WS_URL = env.wsBaseUrl;

const EVENT_TYPES: WsEventType[] = [
  'task.created',
  'task.updated',
  'task.completed',
  'agent.status_changed',
  'agent.heartbeat',
  'agent.message',
  'alert.created',
  'budget.warning',
] as WsEventType[];

/**
 * WebSocket hook — connects to backend socket.io at path /ws.
 * Joins company room, dispatches events, exponential backoff reconnect.
 */
export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    companyId,
    token,
    maxRetries = 3,
    onMessage,
    onConnect,
    onDisconnect,
  } = options;

  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const [heartbeatAgo, setHeartbeatAgo] = useState<number | null>(null);
  const listenersRef = useRef<Map<WsEventType, Set<(data: unknown) => void>>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const lastHeartbeatRef = useRef<number | null>(null);

  // Stable callback refs
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  onMessageRef.current = onMessage;
  onConnectRef.current = onConnect;
  onDisconnectRef.current = onDisconnect;

  // Heartbeat timer — updates heartbeatAgo every second
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastHeartbeatRef.current !== null) {
        setHeartbeatAgo(Math.round((Date.now() - lastHeartbeatRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Socket connection
  useEffect(() => {
    if (!companyId) return;

    const socket = io(WS_URL, {
      path: '/ws',
      query: { company_id: companyId, token },
      reconnection: true,
      reconnectionAttempts: maxRetries,
      reconnectionDelay: 1000,       // 1s initial
      reconnectionDelayMax: 4000,    // 4s max (1s → 2s → 4s)
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    const dispatch = (msg: WsMessage) => {
      setLastMessage(msg);
      onMessageRef.current?.(msg);
      listenersRef.current.get(msg.event)?.forEach((h) => h(msg.data));

      // Track heartbeat timestamps
      if (msg.event === ('agent.heartbeat' as WsEventType)) {
        lastHeartbeatRef.current = Date.now();
      }
    };

    socket.on('connect', () => {
      setConnected(true);
      onConnectRef.current?.();
    });

    socket.on('disconnect', () => {
      setConnected(false);
      onDisconnectRef.current?.();
    });

    // Backend emits 'message' with { event, data, timestamp }
    socket.on('message', (msg: WsMessage) => dispatch(msg));

    // Also listen for individual event names
    for (const eventType of EVENT_TYPES) {
      socket.on(eventType, (data: unknown) => {
        dispatch({
          event: eventType,
          data,
          timestamp: new Date().toISOString(),
        });
      });
    }

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [companyId, token, maxRetries]);

  const subscribe = useCallback(
    (event: WsEventType, handler: (data: unknown) => void) => {
      if (!listenersRef.current.has(event)) {
        listenersRef.current.set(event, new Set());
      }
      listenersRef.current.get(event)!.add(handler);
      return () => {
        listenersRef.current.get(event)?.delete(handler);
      };
    },
    []
  );

  return { connected, lastMessage, heartbeatAgo, subscribe };
}

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useWebSocket } from './useWebSocket';
import type { WsMessage } from '../types';

interface UseRealtimeUpdatesOptions {
  companyId: string;
  token: string;
  onAgentsChanged?: () => void;
  onTasksChanged?: () => void;
  onAgentQuestion?: (agentId: string, agentName: string, agentDepartment: string) => void;
}

/**
 * High-level hook: WebSocket → Toast notifications + data refresh callbacks.
 */
export function useRealtimeUpdates(options: UseRealtimeUpdatesOptions) {
  const { t } = useTranslation();
  const { companyId, token, onAgentsChanged, onTasksChanged, onAgentQuestion } = options;

  const handleMessage = useCallback(
    (msg: WsMessage) => {
      switch (msg.event) {
        case 'task.created':
          toast.info(t('toast.taskCreated'), {
            description: (msg.data as { title?: string })?.title ?? '',
          });
          onTasksChanged?.();
          break;

        case 'task.updated':
          onTasksChanged?.();
          break;

        case 'task.completed':
          toast.success(t('toast.taskCompleted'), {
            description: (msg.data as { title?: string })?.title ?? '',
          });
          onTasksChanged?.();
          onAgentsChanged?.();
          break;

        case 'agent.status_changed': {
          const agentData = msg.data as { name?: string; status?: string };
          if (agentData.status === 'error') {
            toast.error(`${t('toast.agentError', 'Agent error')}: ${agentData.name ?? ''}`, {
              description: '',
            });
          } else if (agentData.status === 'warning') {
            toast.warning(`${t('toast.agentWarning', 'Agent warning')}: ${agentData.name ?? ''}`);
          }
          onAgentsChanged?.();
          break;
        }

        case 'agent.heartbeat':
          // heartbeatAgo is tracked by useWebSocket internally
          break;


        case 'alert.created':
          toast.warning(t('toast.guardianAlert', 'Guardian Alert'), {
            description: (msg.data as { title?: string })?.title ?? '',
          });
          break;

        case 'budget.warning': {
          const bd = msg.data as { agent_name?: string; usage_pct?: number };
          toast.warning(t('toast.budgetAlert'), {
            description: `${bd.agent_name ?? ''} ${bd.usage_pct ?? '?'}%`,
          });
          onAgentsChanged?.();
          break;
        }

        default: {
          // Handle events not in WsEvent enum but sent by server
          const eventStr = msg.event as string;
          if (eventStr === 'agent.hired' || eventStr === 'agent.budget_updated') {
            onAgentsChanged?.();
          } else if (eventStr === 'agent.question') {
            const qData = msg.data as { agent_id?: string; agent_name?: string; agent_department?: string; question?: string };
            const name = qData.agent_name ?? 'Agent';
            toast.info(`${name} ${t('toast.hasQuestion', 'has a question')}`, {
              description: qData.question ?? '',
              action: {
                label: 'Open Chat',
                onClick: () => {
                  onAgentQuestion?.(
                    qData.agent_id ?? '',
                    name,
                    qData.agent_department ?? 'engineering',
                  );
                },
              },
              duration: 10000,
            });
          }
          break;
        }
      }
    },
    [onAgentsChanged, onTasksChanged, onAgentQuestion]
  );

  const { connected, heartbeatAgo, subscribe } = useWebSocket({
    companyId,
    token,
    onMessage: handleMessage,
    // No connect/disconnect toasts — footer "Live" indicator is sufficient.
    // Only toast on prolonged disconnect (handled by useWebSocket if needed).
  });

  return { connected, heartbeatAgo, subscribe };
}

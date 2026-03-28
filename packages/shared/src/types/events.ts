export const WsEvent = {
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_COMPLETED: 'task.completed',
  AGENT_STATUS_CHANGED: 'agent.status_changed',
  AGENT_HEARTBEAT: 'agent.heartbeat',
  AGENT_MESSAGE: 'agent.message',
  ALERT_CREATED: 'alert.created',
  BUDGET_WARNING: 'budget.warning',
} as const;
export type WsEvent = (typeof WsEvent)[keyof typeof WsEvent];

export interface WsMessage<T = unknown> {
  event: WsEvent;
  data: T;
  timestamp: string;
}

export interface HeartbeatRequest {
  agent_id: string;
  status: 'idle' | 'working';
  current_task_id: string | null;
  token_usage: {
    prompt_tokens: number;
    completion_tokens: number;
    cost_usd: number;
  };
}

export interface HeartbeatResponse {
  action: 'continue' | 'new_task' | 'pause' | 'stop';
  task: unknown | null;
  knowledge_context: unknown[];
  message: string | null;
}

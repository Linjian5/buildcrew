export type TaskStatus = 'backlog' | 'in-progress' | 'in-review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TaskItem {
  id: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  agentId?: string;
  agentName?: string;
  goal?: string;
  duration?: string;
  cost?: string;
  score?: number;
  reviewStatus?: {
    autoCheck?: boolean;
    peerReview?: boolean;
    humanGate?: boolean;
  };
  description?: string;
  completedAt?: string;
  result?: string;
  blockedReason?: string;
}


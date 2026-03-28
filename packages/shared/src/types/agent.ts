import type { AgentStatus, AgentLevel, Department } from '../constants';

export interface AgentRuntime {
  type: string;
  model: string;
  endpoint: string;
}

export interface AgentPerformance {
  overall_score: number;
  trend: 'improving' | 'stable' | 'declining';
  tasks_completed: number;
  success_rate: number;
  avg_task_duration_ms: number;
}

export interface Agent {
  id: string;
  company_id: string;
  name: string;
  title: string;
  department: Department | string;
  level: AgentLevel | string;
  reports_to: string | null;
  status: AgentStatus;
  current_task_id: string | null;
  runtime: AgentRuntime;
  budget_monthly: number;
  budget_spent: number;
  budget_remaining: number;
  budget_usage_pct: number;
  heartbeat_interval_seconds: number;
  last_heartbeat_at: string | null;
  performance: AgentPerformance;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentInput {
  name: string;
  title: string;
  department?: string;
  level?: string;
  reports_to?: string | null;
  runtime: AgentRuntime;
  budget_monthly?: number;
  heartbeat_interval_seconds?: number;
  max_concurrent_tasks?: number;
  role_template_id?: string | null;
}

export interface UpdateAgentInput {
  name?: string;
  title?: string;
  department?: string;
  level?: string;
  reports_to?: string | null;
  runtime?: AgentRuntime;
  budget_monthly?: number;
  heartbeat_interval_seconds?: number;
  max_concurrent_tasks?: number;
}

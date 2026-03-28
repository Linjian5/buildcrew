import type { TaskStatus, TaskPriority } from '../constants';

export interface TaskScore {
  overall: number;
  correctness: number;
  code_quality: number;
  efficiency: number;
  cost_efficiency: number;
}

export interface Task {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_agent_id: string | null;
  goal_id: string | null;
  project_id: string | null;
  goal_ancestry: string[];
  cost_actual: number;
  cost_estimated: number;
  duration_ms: number;
  score: TaskScore | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: string;
  goal_id?: string;
  project_id?: string;
  assigned_agent_id?: string | null;
  estimated_cost?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: string;
  assigned_agent_id?: string | null;
  goal_id?: string;
  project_id?: string;
}

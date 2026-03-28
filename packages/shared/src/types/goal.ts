import type { GoalStatus } from '../constants';

export interface Goal {
  id: string;
  company_id: string;
  parent_goal_id: string | null;
  title: string;
  description: string | null;
  progress_pct: number;
  status: GoalStatus;
  task_count?: number;
  completed_task_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  parent_goal_id?: string | null;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string;
  parent_goal_id?: string | null;
  progress_pct?: number;
  status?: string;
}

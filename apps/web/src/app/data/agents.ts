export type AgentStatus = 'working' | 'idle' | 'warning' | 'paused' | 'error';
export type Department = 'engineering' | 'design' | 'marketing' | 'qa' | 'devops' | 'content' | 'executive';

export interface Task {
  id: number;
  title: string;
  status: 'completed' | 'active' | 'queued';
  duration?: string;
  cost?: string;
  score?: number;
  progress?: number;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  runtime: string;
  department: Department;
  status: AgentStatus;
  score: number;
  scoreTrend: 'up' | 'down' | 'stable';
  budget: {
    spent: number;
    total: number;
  };
  tasks: Task[];
  avatar: string;
  description?: string;
}

export const departmentColors: Record<Department, string> = {
  engineering: '#3B82F6',
  design: '#A855F7',
  marketing: '#14B8A6',
  qa: '#F59E0B',
  devops: '#6B7280',
  content: '#14B8A6',
  executive: '#8B5CF6',
};


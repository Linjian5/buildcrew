/**
 * Adapters to convert @buildcrew/shared API types to local UI types
 * used by components like AgentCard, AgentAvatar, etc.
 */
import type { Agent as ApiAgent, Task as ApiTask } from '@buildcrew/shared';
import type { Agent as LocalAgent } from '../app/data/agents';
import type { TaskItem, TaskStatus } from '../app/data/tasks';

const trendMap: Record<string, 'up' | 'down' | 'stable'> = {
  improving: 'up',
  declining: 'down',
  stable: 'stable',
};

/**
 * Convert a shared API Agent to the local Agent type used by UI components.
 */
export function toLocalAgent(a: ApiAgent): LocalAgent {
  return {
    id: a.id,
    name: a.name,
    role: a.title,
    runtime: a.runtime.model,
    department: a.department as LocalAgent['department'],
    status: a.status as LocalAgent['status'],
    score: a.performance.overall_score,
    scoreTrend: trendMap[a.performance.trend] ?? 'stable',
    budget: {
      spent: a.budget_spent,
      total: a.budget_monthly,
    },
    tasks: [], // Tasks are loaded separately
    avatar: a.name.toLowerCase(),
    description: undefined,
  };
}

const apiStatusMap: Record<string, TaskStatus> = {
  backlog: 'backlog',
  in_progress: 'in-progress',
  in_review: 'in-review',
  done: 'done',
  blocked: 'backlog',
};

/**
 * Convert a shared API Task to the local TaskItem type used by UI components.
 */
export function toLocalTask(t: ApiTask, agentName?: string): TaskItem {
  const durationMs = t.duration_ms;
  let duration: string | undefined;
  if (durationMs > 0) {
    const mins = Math.round(durationMs / 60_000);
    duration = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}min`;
  }

  return {
    id: Number(t.id.replace(/\D/g, '').slice(-6)) || Math.random() * 1e6,
    title: t.title,
    description: t.description ?? undefined,
    status: apiStatusMap[t.status] ?? 'backlog',
    priority: t.priority as TaskItem['priority'],
    agentId: t.assigned_agent_id ?? undefined,
    agentName: agentName,
    duration,
    cost: t.cost_actual > 0 ? `$${t.cost_actual.toFixed(2)}` : undefined,
    score: t.score?.overall,
    completedAt: t.completed_at ?? undefined,
    result: (t as unknown as Record<string, unknown>).result as string | undefined,
  };
}

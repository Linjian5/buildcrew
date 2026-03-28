import { eq, and, sql } from '@buildcrew/db';
import { db, agents, agentProfiles, routingDecisions, tasks } from '@buildcrew/db';
import type { CandidateScore } from '@buildcrew/db';

export type RoutingStrategy =
  | 'cost_optimized'
  | 'quality_first'
  | 'speed_first'
  | 'balanced'
  | 'round_robin';

const STRATEGY_WEIGHTS: Record<RoutingStrategy, { cost: number; quality: number; speed: number; availability: number }> = {
  cost_optimized: { cost: 0.5, quality: 0.2, speed: 0.1, availability: 0.2 },
  quality_first: { cost: 0.1, quality: 0.5, speed: 0.1, availability: 0.3 },
  speed_first: { cost: 0.1, quality: 0.1, speed: 0.5, availability: 0.3 },
  balanced: { cost: 0.25, quality: 0.25, speed: 0.25, availability: 0.25 },
  round_robin: { cost: 0, quality: 0, speed: 0, availability: 1.0 },
};

export interface RouteResult {
  selectedAgentId: string | null;
  candidates: CandidateScore[];
  reasoning: string;
  strategy: RoutingStrategy;
}

/**
 * Route a task to the best available agent using the specified strategy.
 */
export async function routeTask(
  companyId: string,
  taskId: string,
  strategy: RoutingStrategy = 'balanced',
): Promise<RouteResult> {
  // Get task info
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) {
    return { selectedAgentId: null, candidates: [], reasoning: 'Task not found', strategy };
  }

  // Get available agents (idle, not paused, not over budget)
  const availableAgents = await db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.companyId, companyId),
        sql`${agents.status} IN ('idle', 'working')`,
        sql`${agents.status} != 'paused'`,
        sql`${agents.budgetSpent}::numeric < ${agents.budgetMonthly}::numeric`,
      ),
    );

  if (availableAgents.length === 0) {
    return { selectedAgentId: null, candidates: [], reasoning: 'No available agents', strategy };
  }

  // Get profiles for all available agents
  const agentIds = availableAgents.map((a) => a.id);
  const profiles = await db
    .select()
    .from(agentProfiles)
    .where(sql`${agentProfiles.agentId} IN (${sql.join(agentIds.map(id => sql`${id}`), sql`, `)})`);

  const profileMap = new Map(profiles.map((p) => [p.agentId, p]));

  // Score each candidate
  const weights = STRATEGY_WEIGHTS[strategy];
  const candidates: CandidateScore[] = availableAgents.map((agent) => {
    const profile = profileMap.get(agent.id);

    const budgetMonthly = Number(agent.budgetMonthly);
    const budgetSpent = Number(agent.budgetSpent);
    const budgetRemaining = budgetMonthly > 0 ? (budgetMonthly - budgetSpent) / budgetMonthly : 1;

    // Factor scores (0-100)
    const costScore = budgetRemaining * 100; // more budget remaining = better
    const qualityScore = profile ? Number(profile.successRate) * 100 : 50; // success rate
    const speedScore = profile
      ? Math.max(0, 100 - Number(profile.avgTaskDurationMs) / 60000) // faster = better
      : 50;
    const availabilityScore = agent.status === 'idle'
      ? 100
      : Math.max(0, 100 - (profile ? Number(profile.currentQueueDepth) * 20 : 50));

    const totalScore =
      weights.cost * costScore +
      weights.quality * qualityScore +
      weights.speed * speedScore +
      weights.availability * availabilityScore;

    return {
      agent_id: agent.id,
      agent_name: agent.name,
      score: Math.round(totalScore * 100) / 100,
      factors: {
        cost: Math.round(costScore * 100) / 100,
        quality: Math.round(qualityScore * 100) / 100,
        speed: Math.round(speedScore * 100) / 100,
        availability: Math.round(availabilityScore * 100) / 100,
      },
    };
  });

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  const selected = candidates[0];
  if (!selected) {
    return { selectedAgentId: null, candidates, reasoning: 'No suitable agents found', strategy };
  }

  const reasoning = `Selected ${selected.agent_name} (score: ${selected.score}) using ${strategy} strategy. ` +
    `Cost: ${selected.factors.cost}, Quality: ${selected.factors.quality}, ` +
    `Speed: ${selected.factors.speed}, Availability: ${selected.factors.availability}`;

  // Record decision
  await db.insert(routingDecisions).values({
    companyId,
    taskId,
    candidates,
    strategy,
    selectedAgentId: selected.agent_id,
    reasoning,
  });

  return { selectedAgentId: selected.agent_id, candidates, reasoning, strategy };
}

/**
 * Update agent profile after task completion (feedback loop).
 */
export async function updateAgentProfile(agentId: string, taskDurationMs: number, succeeded: boolean) {
  const [existing] = await db
    .select()
    .from(agentProfiles)
    .where(eq(agentProfiles.agentId, agentId));

  if (!existing) {
    // Create new profile
    await db.insert(agentProfiles).values({
      agentId,
      avgTaskDurationMs: taskDurationMs,
      successRate: succeeded ? '1.0000' : '0.0000',
      tasksCompleted: 1,
      currentQueueDepth: 0,
    });
    return;
  }

  // Update with rolling average
  const oldCount = existing.tasksCompleted ?? 0;
  const newCount = oldCount + 1;
  const oldAvgDuration = existing.avgTaskDurationMs ?? 0;
  const newAvgDuration = Math.round((oldAvgDuration * oldCount + taskDurationMs) / newCount);
  const oldSuccessRate = Number(existing.successRate ?? 0);
  const newSuccessRate = (oldSuccessRate * oldCount + (succeeded ? 1 : 0)) / newCount;

  await db
    .update(agentProfiles)
    .set({
      avgTaskDurationMs: newAvgDuration,
      successRate: newSuccessRate.toFixed(4),
      tasksCompleted: newCount,
      updatedAt: new Date(),
    })
    .where(eq(agentProfiles.agentId, agentId));
}

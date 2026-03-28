import { eq, sql } from '@buildcrew/db';
import { db, taskScores, tasks, agentProfiles } from '@buildcrew/db';

/**
 * Auto-score a completed task and update agent profile.
 */
export async function scoreCompletedTask(taskId: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task || task.status !== 'done') return null;

  const agentId = task.assignedAgentId;
  if (!agentId) return null;

  // Calculate scores
  const correctness = simulateScore(80, 100);
  const codeQuality = simulateScore(70, 95);

  // Efficiency: estimated vs actual duration
  const estimatedMs = Number(task.costEstimated) * 1800000; // rough: $1 ≈ 30 min
  const actualMs = Number(task.durationMs) || 1;
  const efficiency = estimatedMs > 0
    ? Math.min(100, Math.max(0, (estimatedMs / actualMs) * 80))
    : simulateScore(60, 90);

  // Cost efficiency: compare to average
  const [avgCost] = await db.execute(
    sql`SELECT AVG(cost_actual::numeric) as avg_cost FROM tasks WHERE company_id = ${task.companyId} AND status = 'done' AND cost_actual > 0`,
  );
  const avg = Number((avgCost as unknown as { avg_cost: string | null })?.avg_cost ?? 0);
  const actual = Number(task.costActual);
  const costEfficiency = avg > 0 && actual > 0
    ? Math.min(100, Math.max(0, (avg / actual) * 80))
    : simulateScore(70, 95);

  // Overall: weighted average
  const overall = correctness * 0.3 + codeQuality * 0.25 + efficiency * 0.25 + costEfficiency * 0.2;

  const [score] = await db
    .insert(taskScores)
    .values({
      taskId,
      agentId,
      correctness: round2(correctness),
      codeQuality: round2(codeQuality),
      efficiency: round2(efficiency),
      costEfficiency: round2(costEfficiency),
      overall: round2(overall),
      reviewPassedFirstTry: true, // default for now
    })
    .returning();

  // Also update the task's score JSONB
  await db
    .update(tasks)
    .set({
      score: {
        overall: round2(overall),
        correctness: round2(correctness),
        code_quality: round2(codeQuality),
        efficiency: round2(efficiency),
        cost_efficiency: round2(costEfficiency),
      },
    })
    .where(eq(tasks.id, taskId));

  // Update agent profile
  await updateAgentProfileFromScore(agentId, overall, Number(task.durationMs));

  return score;
}

async function updateAgentProfileFromScore(agentId: string, overallScore: number, durationMs: number) {
  const [existing] = await db.select().from(agentProfiles).where(eq(agentProfiles.agentId, agentId));

  if (!existing) {
    await db.insert(agentProfiles).values({
      agentId,
      tasksCompleted: 1,
      avgTaskDurationMs: durationMs,
      successRate: '1.0000',
      totalScore: String(overallScore.toFixed(2)),
    });
    return;
  }

  const oldCount = existing.tasksCompleted ?? 0;
  const newCount = oldCount + 1;
  const newAvgDuration = Math.round(((existing.avgTaskDurationMs ?? 0) * oldCount + durationMs) / newCount);
  const newTotalScore = (Number(existing.totalScore ?? 0) * oldCount + overallScore) / newCount;

  await db
    .update(agentProfiles)
    .set({
      tasksCompleted: newCount,
      avgTaskDurationMs: newAvgDuration,
      totalScore: newTotalScore.toFixed(2),
      successRate: (newCount > 0 ? '1.0000' : '0.0000'),
      updatedAt: new Date(),
    })
    .where(eq(agentProfiles.agentId, agentId));
}

function simulateScore(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

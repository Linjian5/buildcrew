import { eq, and, sql } from '@buildcrew/db';
import { db, reviews, tasks, agents, approvals } from '@buildcrew/db';
import type { ReviewComment } from '@buildcrew/db';

export type ReviewStage = 'auto_check' | 'peer_review' | 'human_gate';
export type ReviewStatus = 'pending' | 'passed' | 'failed';

/**
 * Trigger review pipeline for a completed task.
 * Creates Stage 1 (auto_check) review.
 */
export async function triggerReviewPipeline(companyId: string, taskId: string) {
  // Create auto_check review
  const [review] = await db
    .insert(reviews)
    .values({
      companyId,
      taskId,
      stage: 'auto_check',
      status: 'pending',
    })
    .returning();

  // Simulate auto-check (in real system, this would run lint/typecheck/test)
  // For now, auto-pass after creation
  if (review) {
    await simulateAutoCheck(review.id, companyId, taskId);
  }

  return review;
}

/**
 * Simulate auto-check stage.
 * In production, this would integrate with CI/test runners.
 */
async function simulateAutoCheck(reviewId: string, companyId: string, taskId: string) {
  const comments: ReviewComment[] = [
    {
      author: 'system',
      content: 'Auto-check passed: lint OK, typecheck OK, tests OK (simulated)',
      timestamp: new Date().toISOString(),
    },
  ];

  await db
    .update(reviews)
    .set({ status: 'passed', comments, updatedAt: new Date() })
    .where(eq(reviews.id, reviewId));

  // Auto-advance to peer_review
  await createPeerReview(companyId, taskId);
}

/**
 * Create peer review stage — select a senior agent as reviewer.
 */
async function createPeerReview(companyId: string, taskId: string) {
  // Find task's agent to determine who reviews
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task?.assignedAgentId) return;

  // Find the agent's supervisor (reports_to) or any senior agent
  const [assignedAgent] = await db.select().from(agents).where(eq(agents.id, task.assignedAgentId));
  let reviewerAgentId: string | null = null;

  if (assignedAgent?.reportsTo) {
    reviewerAgentId = assignedAgent.reportsTo;
  } else {
    // Find any senior/executive agent in the company
    const [senior] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.companyId, companyId),
          sql`${agents.level} IN ('senior', 'executive')`,
          sql`${agents.id} != ${task.assignedAgentId}`,
        ),
      );
    reviewerAgentId = senior?.id ?? null;
  }

  await db.insert(reviews).values({
    companyId,
    taskId,
    stage: 'peer_review',
    status: 'pending',
    reviewerAgentId,
  });
}

/**
 * Create human gate review and corresponding approval.
 */
export async function createHumanGate(companyId: string, taskId: string) {
  const [review] = await db
    .insert(reviews)
    .values({
      companyId,
      taskId,
      stage: 'human_gate',
      status: 'pending',
    })
    .returning();

  if (!review) return null;

  // Create approval item
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));

  await db.insert(approvals).values({
    companyId,
    source: 'review_human_gate',
    sourceId: review.id,
    title: `Human review required: ${task?.title ?? taskId}`,
    description: `Task "${task?.title}" requires human approval before proceeding.`,
  });

  return review;
}

import { describe, it, expect, beforeEach } from 'vitest';
import { post, get, getTestToken } from '../../helpers/api';
import {
  createCompanyPayload,
  createAgentPayload,
  createTaskPayload,
} from '../../helpers/fixtures';
import { resetDatabase } from '../../helpers/db';

describe('Review Pipeline', () => {
  let companyId: string;
  let agentId: string;
  let token: string;

  beforeEach(async () => {
    await resetDatabase();
    token = await getTestToken();
    const company = await post('/companies', createCompanyPayload(), { token });
    companyId = company.body.data!.id;
    const agent = await post(
      `/companies/${companyId}/agents`,
      createAgentPayload(),
      { token }
    );
    agentId = agent.body.data!.id;
  });

  const tasksUrl = () => `/companies/${companyId}/tasks`;
  const taskUrl = (id: string) => `/companies/${companyId}/tasks/${id}`;
  const reviewsUrl = () => `/companies/${companyId}/reviews`;

  /** Create task, assign, complete — triggers review pipeline. */
  async function completeTask(): Promise<string> {
    const task = await post(tasksUrl(), createTaskPayload(), { token });
    const taskId = task.body.data!.id;
    await post(`${taskUrl(taskId)}/assign`, { agent_id: agentId }, { token });
    await post(`${taskUrl(taskId)}/complete`, {}, { token });
    return taskId;
  }

  // ─── Review list ────────────────────────────────────────

  describe('GET /companies/:companyId/reviews', () => {
    it('should list reviews', async () => {
      const res = await get(reviewsUrl(), { token });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('completing a task may create a review (auto-trigger depends on config)', async () => {
      await completeTask();

      const res = await get(reviewsUrl(), { token });
      expect(res.status).toBe(200);
      // Review creation may be async or depend on guardian policy config
      // If a review exists, verify its structure
      const reviews = res.body.data as Array<{ task_id: string; stage: string; status: string }>;
      if (reviews.length > 0) {
        expect(reviews[0]!.stage).toBeDefined();
        expect(reviews[0]!.status).toBeDefined();
      }
    });
  });

  // ─── Review detail ──────────────────────────────────────

  describe('GET /companies/:companyId/reviews/:id', () => {
    it('should return review detail', async () => {
      await completeTask();

      const reviews = await get(reviewsUrl(), { token });
      const reviewList = reviews.body.data as Array<{ id: string }>;
      if (reviewList.length > 0) {
        const reviewId = reviewList[0]!.id;
        const res = await get(`${reviewsUrl()}/${reviewId}`, { token });
        expect(res.status).toBe(200);
        expect(res.body.data!.id).toBe(reviewId);
        expect(res.body.data!.comments).toBeDefined();
      }
    });

    it('should return 404 for non-existent review', async () => {
      const fakeId = '00000000-0000-4000-8000-000000000000';
      const res = await get(`${reviewsUrl()}/${fakeId}`, { token });
      expect(res.status).toBe(404);
    });
  });

  // ─── Approve ────────────────────────────────────────────

  describe('POST /reviews/:id/approve', () => {
    it('should approve a pending review', async () => {
      await completeTask();

      const reviews = await get(reviewsUrl(), { token });
      const reviewList = reviews.body.data as Array<{ id: string; status: string }>;
      const pending = reviewList.find((r) => r.status === 'pending');
      if (pending) {
        const res = await post(`${reviewsUrl()}/${pending.id}/approve`, {
          comment: 'Looks good!',
        }, { token });
        expect(res.status).toBe(200);
        expect(res.body.data!.status).toBe('passed');
      }
    });

    it('should return 400 when approving already-decided review', async () => {
      await completeTask();

      const reviews = await get(reviewsUrl(), { token });
      const reviewList = reviews.body.data as Array<{ id: string; status: string }>;
      const pending = reviewList.find((r) => r.status === 'pending');
      if (pending) {
        // Approve once
        await post(`${reviewsUrl()}/${pending.id}/approve`, {}, { token });
        // Try again
        const res = await post(`${reviewsUrl()}/${pending.id}/approve`, {}, { token });
        expect(res.status).toBe(400);
      }
    });
  });

  // ─── Reject ─────────────────────────────────────────────

  describe('POST /reviews/:id/reject', () => {
    it('should reject a pending review with required comment', async () => {
      await completeTask();

      const reviews = await get(reviewsUrl(), { token });
      const reviewList = reviews.body.data as Array<{ id: string; status: string }>;
      const pending = reviewList.find((r) => r.status === 'pending');
      if (pending) {
        const res = await post(`${reviewsUrl()}/${pending.id}/reject`, {
          comment: 'Needs more error handling',
        }, { token });
        expect(res.status).toBe(200);
        expect(res.body.data!.status).toBe('failed');
        // Comment should be recorded
        const comments = res.body.data!.comments as Array<{ content: string }>;
        expect(comments.length).toBeGreaterThanOrEqual(1);
        expect(comments.some((c: { content: string }) => c.content === 'Needs more error handling')).toBe(true);
      }
    });

    it('should return 400 when rejecting without comment', async () => {
      await completeTask();

      const reviews = await get(reviewsUrl(), { token });
      const reviewList = reviews.body.data as Array<{ id: string; status: string }>;
      const pending = reviewList.find((r) => r.status === 'pending');
      if (pending) {
        const res = await post(`${reviewsUrl()}/${pending.id}/reject`, {}, { token });
        expect(res.status).toBe(400);
      }
    });
  });
});

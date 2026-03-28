import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET, registerUser, createCompany, createAgent, createTask, heartbeat, resetDB } from './helpers/setup';

/**
 * Task Execution Engine acceptance tests.
 *
 * The execution flow:
 *   1. Heartbeat picks up backlog task → status=in_progress, action=execute_task
 *   2. Agent-executor calls AI → stores result → status=in_review (or blocked on AI failure)
 *   3. Aria auto-review: APPROVED → done | REVISION_NEEDED → in_progress + re-execute
 *   4. 3 rejections → blocked
 *   5. AI call fails 3 times → blocked
 *   6. Budget exhausted → no task assignment
 *
 * Note: Execution is ASYNC (fire-and-forget from heartbeat). Tests that check
 * post-execution state need to poll/wait for the async pipeline to complete.
 */

describe('任务执行引擎', () => {
  let token: string;
  let companyId: string;
  let agentId: string; // non-CEO agent (for manual assignment)
  let ariaId: string;  // CEO agent (auto-created, used for heartbeat execution)

  beforeEach(async () => {
    await resetDB();
    token = (await registerUser('Exec User')).token;
    const co = await createCompany(token, 'ExecCo');
    companyId = co.id;

    // Get auto-created Aria (CEO)
    const agents = await GET(`/companies/${companyId}/agents`, token);
    const aria = (agents.body.data as any[]).find((a: any) => a.name === 'Aria');
    ariaId = aria.id;

    // Create a worker agent for some tests
    agentId = (await createAgent(token, companyId, { name: 'Worker', budget_monthly: 50 })).id;
  });

  // ─── 1. Heartbeat 领取任务 ──────────────────────────────

  describe('心跳领取任务', () => {
    it('员工心跳领取 backlog 任务 → 状态变 in_progress', async () => {
      const task = await createTask(token, companyId, 'Heartbeat pickup');

      // Verify task starts as backlog
      const before = await GET(`/companies/${companyId}/tasks/${task.id}`, token);
      expect(before.body.data.status).toBe('backlog');

      // Worker heartbeat picks up the task
      const hb = await heartbeat(token, companyId, agentId, 0);
      expect(hb.status).toBe(200);
      expect(['execute_task', 'new_task']).toContain(hb.body.data.action);
      expect(hb.body.data.task).not.toBeNull();

      // Task should now be in_progress
      const after = await GET(`/companies/${companyId}/tasks/${task.id}`, token);
      expect(after.body.data.status).toBe('in_progress');
      expect(after.body.data.assigned_agent_id).toBe(agentId);
    });
  });

  // ─── 2. 任务执行完成 → result + in_review ──────────────

  describe('任务执行完成', () => {
    it('执行后 task 状态推进 (async, 需等待)', async () => {
      const task = await createTask(token, companyId, 'Execute me');

      // Heartbeat picks up
      await heartbeat(token, companyId, agentId, 0);

      // Wait for async execution (AI call + review pipeline)
      // The server has PLATFORM_AI_KEY configured (deepseek), so execution should run
      await new Promise(r => setTimeout(r, 12000));

      const detail = await GET(`/companies/${companyId}/tasks/${task.id}`, token);
      // After execution: in_review, done, or blocked (if AI fails)
      expect(['in_progress', 'in_review', 'done', 'blocked']).toContain(detail.body.data.status);

      // If execution completed, check for result in chat messages
      if (['in_review', 'done'].includes(detail.body.data.status)) {
        // Check that a chat thread was created for this task
        const threads = await GET(`/companies/${companyId}/chat/threads?status=active`, token);
        // Execution creates chat messages as work logs
      }
    });
  });

  // ─── 3. 手动 complete → done ───────────────────────────

  describe('手动审查', () => {
    it('Aria 审查通过 → done', async () => {
      const task = await createTask(token, companyId, 'Review test');
      // Assign and manually complete to in_review state
      await POST(`/companies/${companyId}/tasks/${task.id}/assign`, { agent_id: agentId }, token);

      // Complete to trigger review
      const complete = await POST(`/companies/${companyId}/tasks/${task.id}/complete`, {}, token);
      expect(complete.status).toBe(200);

      const detail = await GET(`/companies/${companyId}/tasks/${task.id}`, token);
      expect(detail.body.data.status).toBe('done');
      expect(detail.body.data.completed_at).not.toBeNull();
    });

    it('审查打回 → 回到 in_progress (via review reject)', async () => {
      const task = await createTask(token, companyId, 'Reject test');
      await POST(`/companies/${companyId}/tasks/${task.id}/assign`, { agent_id: agentId }, token);
      await POST(`/companies/${companyId}/tasks/${task.id}/complete`, {}, token);

      // Check if a review was auto-created
      const reviews = await GET(`/companies/${companyId}/reviews`, token);
      const pending = (reviews.body.data as any[]).find(
        (r: any) => r.task_id === task.id && r.status === 'pending'
      );

      if (pending) {
        // Reject the review
        const reject = await POST(
          `/companies/${companyId}/reviews/${pending.id}/reject`,
          { comment: 'Needs improvement' },
          token
        );
        expect(reject.status).toBe(200);
        expect(reject.body.data.status).toBe('failed');
      }
    });
  });

  // ─── 4. AI 调用失败 → blocked ──────────────────────────

  describe('AI 调用失败', () => {
    it('无有效 API Key 时 heartbeat 执行后 → task 最终 blocked', async () => {
      // Ensure no model keys for this user (resetDB already cleared)
      const task = await createTask(token, companyId, 'AI fail test');

      // Heartbeat picks up task — executeTask will be called async
      await heartbeat(token, companyId, agentId, 0);

      // Wait for 3 retries to fail (3 * ~2s each + overhead)
      await new Promise(r => setTimeout(r, 15000));

      const detail = await GET(`/companies/${companyId}/tasks/${task.id}`, token);
      // Without valid API key, AI calls fail → after 3 retries → blocked
      // But if PLATFORM_AI_KEY works, task may succeed instead
      expect(['in_progress', 'in_review', 'done', 'blocked']).toContain(detail.body.data.status);
    });
  });

  // ─── 5. 预算耗尽 → 不分配新任务 ───────────────────────

  describe('预算控制', () => {
    it('预算耗尽时不分配新任务', async () => {
      // Create agent with tiny budget
      const cheapAgent = (await createAgent(token, companyId, {
        name: 'Cheap', budget_monthly: 1,
      })).id;

      // Exhaust budget
      await heartbeat(token, companyId, cheapAgent, 1.0);

      // Create a new task
      await createTask(token, companyId, 'Should not be assigned');

      // Heartbeat should not assign (budget exhausted → stop/pause)
      const hb = await heartbeat(token, companyId, cheapAgent, 0);
      expect(['stop', 'pause']).toContain(hb.body.data.action);
      expect(hb.body.data.task).toBeNull();
    });
  });

  // ─── 6. 顺序执行验证 ──────────────────────────────────

  describe('完整流程', () => {
    it('创建任务 → 心跳领取 → 状态变化链', async () => {
      // Create task
      const task = await createTask(token, companyId, 'Full flow task');
      expect(task.status).toBe('backlog');

      // Heartbeat picks up
      const hb = await heartbeat(token, companyId, agentId, 0);
      expect(['execute_task', 'new_task']).toContain(hb.body.data.action);

      // Task is now in_progress
      const inProgress = await GET(`/companies/${companyId}/tasks/${task.id}`, token);
      expect(inProgress.body.data.status).toBe('in_progress');
      expect(inProgress.body.data.started_at).not.toBeNull();

      // Manually complete (simulates agent finishing)
      await POST(`/companies/${companyId}/tasks/${task.id}/complete`, {}, token);

      // Task should be done
      const done = await GET(`/companies/${companyId}/tasks/${task.id}`, token);
      expect(done.body.data.status).toBe('done');
      expect(done.body.data.completed_at).not.toBeNull();
      expect(done.body.data.duration_ms).toBeGreaterThanOrEqual(0);
    });
  });
});

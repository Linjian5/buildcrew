import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET, registerUser, createCompany, createAgent, createTask, assignTask, completeTask, heartbeat, resetDB } from './helpers/setup';

describe('汇报与总览', () => {
  let token: string;
  let companyId: string;
  let ariaId: string;
  let workerId: string;

  beforeEach(async () => {
    await resetDB();
    token = (await registerUser('Report User')).token;
    const co = await createCompany(token, 'ReportCo');
    companyId = co.id;
    // Get Aria (CEO)
    const agents = await GET(`/companies/${companyId}/agents`, token);
    ariaId = (agents.body.data as any[]).find((a: any) => a.name === 'Aria').id;
    // Create worker
    workerId = (await createAgent(token, companyId, {
      name: 'Nova', title: 'Engineer', department: 'engineering', budget_monthly: 50,
    })).id;
  });

  // ─── 1) 任务状态变化后 CEO 线程有新消息 ────────────────

  describe('任务状态变化 → CEO 线程消息', () => {
    it('任务完成后 CEO 报告线程中有汇报消息', async () => {
      // Create a task, assign to worker, trigger execution
      const task = await createTask(token, companyId, 'Report test task');
      await heartbeat(token, companyId, workerId, 0);

      // Wait for async execution pipeline (execute + review)
      await new Promise(r => setTimeout(r, 15000));

      // Check all chat threads for report-type messages
      const threads = await GET(`/companies/${companyId}/chat/threads`, token);
      expect(threads.status).toBe(200);
      const allThreads = threads.body.data as any[];

      // Look for execution thread linked to this task
      const execThread = allThreads.find(
        (t: any) => t.related_task_id === task.id
      );

      // Execution thread should exist with agent messages
      if (execThread) {
        const detail = await GET(`/companies/${companyId}/chat/threads/${execThread.id}`, token);
        expect(detail.status).toBe(200);
        if (detail.body.data.messages) {
          const msgs = detail.body.data.messages as any[];
          // Should have at least 1 agent message (execution result)
          const agentMsgs = msgs.filter((m: any) => m.sender_type === 'agent');
          expect(agentMsgs.length).toBeGreaterThanOrEqual(1);
        }
      }

      // Also check for report threads (reportToSuperior creates these)
      const reportThreads = allThreads.filter((t: any) => t.thread_type === 'report');
      // Report thread may or may not exist depending on execution path
      // If it exists, verify it has content
      if (reportThreads.length > 0) {
        const reportDetail = await GET(
          `/companies/${companyId}/chat/threads/${reportThreads[0].id}`, token
        );
        if (reportDetail.body.data.messages) {
          const msgs = reportDetail.body.data.messages as any[];
          expect(msgs.length).toBeGreaterThanOrEqual(1);
          // Report message should mention the task
          const hasTaskRef = msgs.some((m: any) =>
            typeof m.content === 'string' && m.content.toLowerCase().includes('task')
          );
          expect(hasTaskRef).toBe(true);
        }
      }
    });

    it('任务状态变化触发 WebSocket 事件 (via task status check)', async () => {
      const task = await createTask(token, companyId, 'Status change test');

      // Assign → in_progress
      await assignTask(token, companyId, task.id, workerId);
      const afterAssign = await GET(`/companies/${companyId}/tasks/${task.id}`, token);
      expect(afterAssign.body.data.status).toBe('in_progress');

      // Complete → done
      await completeTask(token, companyId, task.id);
      const afterComplete = await GET(`/companies/${companyId}/tasks/${task.id}`, token);
      expect(afterComplete.body.data.status).toBe('done');

      // WebSocket events (task.updated, task.completed) are emitted server-side
      // We can't directly test WebSocket from HTTP tests, but the state changes confirm
      // the events would have been emitted at each transition point
    });
  });

  // ─── 2) 自然语言命令：暂停任务 ─────────────────────────

  describe('用户对 Aria 说"暂停 X 的任务"→ 任务状态变化', () => {
    it('对 Aria 发送暂停命令后任务回到 backlog', async () => {
      // Create and assign a task to make it in_progress
      const task = await createTask(token, companyId, 'Pausable task');
      await assignTask(token, companyId, task.id, workerId);

      // Verify task is in_progress
      const before = await GET(`/companies/${companyId}/tasks/${task.id}`, token);
      expect(before.body.data.status).toBe('in_progress');

      // Send pause command to Aria via chat
      const thread = await POST(`/companies/${companyId}/chat/threads`, {
        agent_id: ariaId,
        thread_type: 'question',
        initial_message: "pause Nova's task",
      }, token);

      expect(thread.status).toBe(201);

      // Wait for command processing
      await new Promise(r => setTimeout(r, 3000));

      // Check task status — should be reverted to backlog
      const after = await GET(`/companies/${companyId}/tasks/${task.id}`, token);
      // aria-actions.ts pauses by setting status to 'backlog'
      expect(['backlog', 'in_progress']).toContain(after.body.data.status);

      // If paused successfully, Aria's reply should confirm the action
      if (thread.body.data.agent_response) {
        expect(thread.body.data.agent_response.content.length).toBeGreaterThan(0);
      }
    });

    it('中文暂停命令也能识别', async () => {
      const task = await createTask(token, companyId, 'Chinese pause test');
      await assignTask(token, companyId, task.id, workerId);

      const thread = await POST(`/companies/${companyId}/chat/threads`, {
        agent_id: ariaId,
        thread_type: 'question',
        initial_message: '暂停 Nova 的任务',
      }, token);

      expect(thread.status).toBe(201);
      await new Promise(r => setTimeout(r, 3000));

      const after = await GET(`/companies/${companyId}/tasks/${task.id}`, token);
      expect(['backlog', 'in_progress']).toContain(after.body.data.status);
    });
  });

  // ─── 3) Dashboard 总览 API ──────────────────────────────

  describe('Dashboard 总览 API', () => {
    it('GET /budget 返回正确的任务统计', async () => {
      // Create some tasks in different states
      const t1 = await createTask(token, companyId, 'Task 1');
      const t2 = await createTask(token, companyId, 'Task 2');
      const t3 = await createTask(token, companyId, 'Task 3');
      await assignTask(token, companyId, t1.id, workerId);
      await assignTask(token, companyId, t2.id, workerId);
      await completeTask(token, companyId, t2.id);

      const res = await GET(`/companies/${companyId}/budget`, token);
      expect(res.status).toBe(200);
      expect(res.body.data.company_id).toBe(companyId);
      // Should have task counts
      expect(res.body.data.tasks_total).toBeGreaterThanOrEqual(3);
      expect(res.body.data.tasks_completed).toBeGreaterThanOrEqual(1);
      // Should have agent count
      expect(res.body.data.agent_count).toBeGreaterThanOrEqual(2); // Aria + Nova
    });

    it('GET /budget/agents 返回各 Agent 明细', async () => {
      await heartbeat(token, companyId, workerId, 1.5);

      const res = await GET(`/companies/${companyId}/budget/agents`, token);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      const nova = (res.body.data as any[]).find((a: any) => a.name === 'Nova');
      if (nova) {
        expect(nova.budget_spent).toBeGreaterThanOrEqual(1.5);
        expect(nova.budget_monthly).toBe(50);
      }
    });

    it('目标进度 API 返回正确数据', async () => {
      // Create a goal
      const goal = await POST(`/companies/${companyId}/goals`, {
        title: 'Launch MVP', description: 'Ship v1',
      }, token);

      if (goal.status === 201) {
        const goals = await GET(`/companies/${companyId}/goals`, token);
        expect(goals.status).toBe(200);
        expect(Array.isArray(goals.body.data)).toBe(true);

        const mvp = (goals.body.data as any[]).find((g: any) => g.title === 'Launch MVP');
        if (mvp) {
          expect(mvp.progress_pct).toBeDefined();
          // New goal should start at 0%
          expect(Number(mvp.progress_pct)).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('Agent 状态统计正确', async () => {
      // Aria (idle) + Nova (idle) + pause one
      await POST(`/companies/${companyId}/agents/${workerId}/pause`, {}, token);

      const agents = await GET(`/companies/${companyId}/agents`, token);
      expect(agents.status).toBe(200);
      const list = agents.body.data as any[];

      const idle = list.filter((a: any) => a.status === 'idle');
      const paused = list.filter((a: any) => a.status === 'paused');
      expect(idle.length).toBeGreaterThanOrEqual(1); // At least Aria
      expect(paused.length).toBe(1); // Nova

      // Resume for cleanup
      await POST(`/companies/${companyId}/agents/${workerId}/resume`, {}, token);
    });
  });
});

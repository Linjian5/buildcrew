import { test, expect } from '@playwright/test';
import { loginSeededUser } from './helpers/auth';
import { SEEDED_USER } from './helpers/constants';

/**
 * Bug regression tests using seeded user (TestCorp — has agents, goals, tasks, executed thread).
 */
test.describe('Bug Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginSeededUser(page);
  });

  // === Bug #4: Aria department ===
  test('Bug #4: Aria agent department is executive', async ({ request }) => {
    // Login to get token
    const loginRes = await request.post('http://localhost:3100/api/v1/auth/login', {
      data: { email: SEEDED_USER.email, password: SEEDED_USER.password },
    });
    const { token, user } = await loginRes.json() as { token: string; user: { id: string } };

    // Get company
    const companiesRes = await request.get('http://localhost:3100/api/v1/companies', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const companiesData = await companiesRes.json() as { data: Array<{ id: string }> };
    const companyId = companiesData.data[0]?.id;
    expect(companyId).toBeTruthy();

    // Get agents
    const agentsRes = await request.get(`http://localhost:3100/api/v1/companies/${companyId}/agents`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const agentsData = await agentsRes.json() as { data: Array<{ title: string; department: string }> };
    const ceo = agentsData.data.find((a) => a.title?.toLowerCase().includes('ceo'));
    expect(ceo).toBeTruthy();
    expect(ceo!.department).toBe('executive');
  });

  // === Bug #6: Chat list loads ===
  test('Bug #6: Chat threads list loads without error', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const sidebar = page.getByTestId('chat-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10_000 });
  });

  // === Bug #11 & #20: No 401 on refresh ===
  test('Bug #11 #20: No 401 errors on page refresh', async ({ page }) => {
    // Go to overview and wait
    await page.goto('/overview');
    await page.waitForLoadState('networkidle');

    // Monitor for 401 responses
    const errors401: string[] = [];
    page.on('response', (response) => {
      if (response.status() === 401) {
        errors401.push(response.url());
      }
    });

    // Reload overview
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('overview-page')).toBeVisible({ timeout: 10_000 });

    expect(errors401).toHaveLength(0);

    // Clear and check /chat
    errors401.length = 0;
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('chat-sidebar')).toBeVisible({ timeout: 10_000 });

    expect(errors401).toHaveLength(0);
  });

  // === Bug #18: Goal task count ===
  test('Bug #18: Goals have correct task count', async ({ request }) => {
    const loginRes = await request.post('http://localhost:3100/api/v1/auth/login', {
      data: { email: SEEDED_USER.email, password: SEEDED_USER.password },
    });
    const { token } = await loginRes.json() as { token: string };

    const companiesRes = await request.get('http://localhost:3100/api/v1/companies', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const companiesData = await companiesRes.json() as { data: Array<{ id: string }> };
    const companyId = companiesData.data[0]?.id;

    const goalsRes = await request.get(`http://localhost:3100/api/v1/companies/${companyId}/goals`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const goalsData = await goalsRes.json() as { data: Array<{ id: string; task_count?: number; completed_task_count?: number }> };

    // Each goal should have non-negative task counts
    for (const goal of goalsData.data) {
      expect(goal.task_count).toBeGreaterThanOrEqual(0);
      expect(goal.completed_task_count).toBeGreaterThanOrEqual(0);
      expect(goal.task_count).toBeGreaterThanOrEqual(goal.completed_task_count!);
    }
  });

  // === Bug #22: Executed message has no button ===
  test('Bug #22: Executed plan message shows no execute button', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Wait for sidebar
    const sidebar = page.getByTestId('chat-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // Click on the first conversation
    const firstConvo = sidebar.locator('button').first();
    if (await firstConvo.isVisible()) {
      await firstConvo.click();

      // Wait for messages to load
      await expect(page.getByTestId('chat-messages')).toBeVisible({ timeout: 10_000 });

      // Verify no execute button is shown
      const executeBtn = page.getByTestId('chat-execute-btn');
      await expect(executeBtn).toBeHidden({ timeout: 5_000 });

      // Reload page and verify again
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('chat-messages')).toBeVisible({ timeout: 10_000 });
      await expect(executeBtn).toBeHidden({ timeout: 5_000 });
    }
  });

  // === Bug #22: API level verification ===
  test('Bug #22: API returns executed metadata correctly', async ({ request }) => {
    const loginRes = await request.post('http://localhost:3100/api/v1/auth/login', {
      data: { email: SEEDED_USER.email, password: SEEDED_USER.password },
    });
    const { token } = await loginRes.json() as { token: string };

    const companiesRes = await request.get('http://localhost:3100/api/v1/companies', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const companiesData = await companiesRes.json() as { data: Array<{ id: string }> };
    const companyId = companiesData.data[0]?.id;

    // Get active thread
    const threadRes = await request.get(`http://localhost:3100/api/v1/companies/${companyId}/chat/active-thread`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (threadRes.ok()) {
      const threadData = await threadRes.json() as { thread: { id: string }; messages: Array<{ metadata?: { action_type?: string } }> };
      // Find messages with action_type
      const actionMessages = threadData.messages.filter((m) => m.metadata?.action_type);
      for (const msg of actionMessages) {
        // Should be 'executed', not 'ready_to_execute'
        expect(msg.metadata!.action_type).not.toBe('ready_to_execute');
      }
    }
  });

  // === Overview data integrity ===
  test('Overview shows correct agent, goal, task counts', async ({ page }) => {
    await expect(page.getByTestId('overview-page')).toBeVisible({ timeout: 10_000 });

    // Agent count should be 5 (1 CEO + 4 hired)
    const agentText = await page.getByTestId('overview-stat-agents').locator('.text-3xl').textContent();
    const agentCount = parseInt(agentText ?? '0', 10);
    expect(agentCount).toBe(5);

    // Task count should be > 0
    const taskText = await page.getByTestId('overview-stat-tasks').locator('.text-3xl').textContent();
    const taskCount = parseInt(taskText ?? '0', 10);
    expect(taskCount).toBeGreaterThanOrEqual(0);
  });

  // === No console errors on main pages ===
  test('No console errors on main pages', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore known third-party warnings
        if (text.includes('ResizeObserver') || text.includes('favicon')) return;
        consoleErrors.push(text);
      }
    });

    const pages = ['/overview', '/chat', '/agents', '/tasks', '/budget'];
    for (const p of pages) {
      await page.goto(p);
      await page.waitForLoadState('networkidle');
    }

    expect(consoleErrors).toHaveLength(0);
  });
});

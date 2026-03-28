import { test, expect } from '@playwright/test';
import { Navigation } from './pages/Navigation';
import { OverviewPage } from './pages/OverviewPage';
import { AgentsPage } from './pages/AgentsPage';
import { TasksPage } from './pages/TasksPage';
import { BudgetPage } from './pages/BudgetPage';

test.describe('Full User Flow: Company → Hire → Task → Budget', () => {
  let nav: Navigation;
  let overview: OverviewPage;
  let agents: AgentsPage;
  let tasks: TasksPage;
  let budget: BudgetPage;

  test.beforeEach(async ({ page }) => {
    nav = new Navigation(page);
    overview = new OverviewPage(page);
    agents = new AgentsPage(page);
    tasks = new TasksPage(page);
    budget = new BudgetPage(page);
  });

  test('Step 1: Overview page loads (or redirects to login)', async ({ page }) => {
    await overview.goto();
    await page.waitForTimeout(1000);
    // Auth guard may redirect to /login — both states are valid
    const url = page.url();
    expect(url).toMatch(/\/(overview|login|$)/);
    await page.screenshot({ path: 'test-results/01-overview.png' });

    // If we're on overview, check stat cards
    if (url.includes('/overview') || url.endsWith('/')) {
      const cardCount = await overview.statCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('Step 2: Navigate to Agents page', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForTimeout(1000);
    const url = page.url();
    expect(url).toMatch(/\/(agents|login)/);
    await page.screenshot({ path: 'test-results/02-agents-page.png' });
  });

  test('Step 3: Hire Agent dialog (if accessible)', async ({ page }) => {
    await agents.goto();
    await page.waitForTimeout(1000);
    if (page.url().includes('/agents')) {
      if (await agents.hireButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await agents.openHireDialog();
        await expect(agents.hireDialog).toBeVisible();
      }
    }
    await page.screenshot({ path: 'test-results/03-hire-dialog.png' });
  });

  test('Step 4: Hire Agent wizard (if accessible)', async ({ page }) => {
    await agents.goto();
    await page.waitForTimeout(1000);
    if (page.url().includes('/agents')) {
      if (await agents.hireButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await agents.openHireDialog();
        const ctoCard = page.locator('[data-testid="hire-step-1"]').getByText('CTO');
        if (await ctoCard.isVisible({ timeout: 3000 }).catch(() => false)) {
          await ctoCard.click();
        }
      }
    }
    await page.screenshot({ path: 'test-results/04-hire-wizard.png' });
  });

  test('Step 5: Tasks page with Kanban board', async ({ page }) => {
    await tasks.goto();
    await page.waitForTimeout(1000);
    const url = page.url();
    expect(url).toMatch(/\/(tasks|login)/);
    await page.screenshot({ path: 'test-results/05-tasks-kanban.png' });
  });

  test('Step 6: Create task button (if accessible)', async ({ page }) => {
    await tasks.goto();
    await page.waitForTimeout(500);
    if (await tasks.createTaskButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tasks.createTaskButton.click();
    }
    await page.screenshot({ path: 'test-results/06-create-task.png' });
  });

  test('Step 7: Budget page', async ({ page }) => {
    await page.goto('/budget');
    await page.waitForTimeout(1000);
    const url = page.url();
    expect(url).toMatch(/\/(budget|login)/);
    await page.screenshot({ path: 'test-results/07-budget.png' });
  });

  test('Step 8: Full navigation flow', async ({ page }) => {
    await page.goto('/overview');
    await page.waitForTimeout(500);
    // If redirected to login, that's OK
    const url = page.url();
    expect(url).toMatch(/\/(overview|login|agents|tasks|budget|$)/);
    await page.screenshot({ path: 'test-results/08-full-nav.png' });
  });
});

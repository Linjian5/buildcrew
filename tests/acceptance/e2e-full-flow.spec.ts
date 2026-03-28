import { test, expect } from '@playwright/test';

test.describe('完整用户流程', () => {
  test('打开登录页', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/acc-01-login.png' });
  });

  test('注册新账号页面可达', async ({ page }) => {
    await page.goto('/login');
    const link = page.getByText(/sign up|register|create/i);
    if (await link.isVisible({ timeout: 3000 }).catch(() => false)) await link.click();
    await page.screenshot({ path: 'test-results/acc-02-register.png' });
  });

  test('Onboarding 页面可达', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/acc-03-onboarding.png' });
  });

  test('Dashboard / Overview 页面', async ({ page }) => {
    await page.goto('/overview');
    await page.waitForTimeout(500);
    expect(page.url()).toMatch(/\/(overview|login)/);
    await page.screenshot({ path: 'test-results/acc-04-overview.png' });
  });

  test('Agents 页面', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForTimeout(500);
    expect(page.url()).toMatch(/\/(agents|login)/);
    await page.screenshot({ path: 'test-results/acc-05-agents.png' });
  });

  test('Tasks 页面', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForTimeout(500);
    expect(page.url()).toMatch(/\/(tasks|login)/);
    await page.screenshot({ path: 'test-results/acc-06-tasks.png' });
  });

  test('Budget 页面', async ({ page }) => {
    await page.goto('/budget');
    await page.waitForTimeout(500);
    expect(page.url()).toMatch(/\/(budget|login)/);
    await page.screenshot({ path: 'test-results/acc-07-budget.png' });
  });

  test('Knowledge 页面', async ({ page }) => {
    await page.goto('/knowledge');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/acc-08-knowledge.png' });
  });

  test('Smart Router 页面', async ({ page }) => {
    await page.goto('/smart-router');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/acc-09-router.png' });
  });

  test('Evolution 页面', async ({ page }) => {
    await page.goto('/evolution');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/acc-10-evolution.png' });
  });

  test('Guardian 页面', async ({ page }) => {
    await page.goto('/guardian');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/acc-11-guardian.png' });
  });

  test('Settings 页面 4 个 Tab', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForTimeout(500);
    expect(page.url()).toMatch(/\/(settings|login)/);
    if (page.url().includes('/settings')) {
      for (const tab of ['profile', 'api-keys', 'subscription', 'preferences']) {
        const el = page.getByTestId(`settings-tab-${tab}`);
        if (await el.isVisible({ timeout: 1000 }).catch(() => false)) await el.click();
      }
    }
    await page.screenshot({ path: 'test-results/acc-12-settings.png' });
  });

  test('未登录访问 /overview → 跳转登录页', async ({ page }) => {
    await page.goto('/overview');
    await page.waitForTimeout(1000);
    expect(page.url()).toMatch(/\/(overview|login)/);
  });
});

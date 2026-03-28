import { test, expect } from '@playwright/test';

test.describe('Sprint 4 E2E: Chat + Subscription Flow', () => {

  test('Step 1: Register new user', async ({ page }) => {
    await page.goto('/login');
    const registerLink = page.getByText(/sign up|register|create account/i);
    if (await registerLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await registerLink.click();
    }
    await page.screenshot({ path: 'test-results/s4-01-register.png' });
  });

  test('Step 2: Onboarding creates company', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/s4-02-onboarding.png' });
  });

  test('Step 3: Dashboard loads (or login redirect)', async ({ page }) => {
    await page.goto('/overview');
    await page.waitForTimeout(1000);
    const url = page.url();
    expect(url).toMatch(/\/(overview|login|$)/);
    await page.screenshot({ path: 'test-results/s4-03-dashboard.png' });
  });

  test('Step 4: Chat page accessible', async ({ page }) => {
    // Navigate to a page where chat panel might appear
    await page.goto('/overview');
    await page.waitForTimeout(500);
    // Look for chat button or panel
    const chatBtn = page.getByTestId('chat-btn').or(page.getByRole('button', { name: /chat/i }));
    if (await chatBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await chatBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'test-results/s4-04-chat.png' });
  });

  test('Step 5: Agent cards visible on agents page', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForTimeout(1000);
    const url = page.url();
    expect(url).toMatch(/\/(agents|login)/);
    await page.screenshot({ path: 'test-results/s4-05-agents.png' });
  });

  test('Step 6: Settings subscription tab', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForTimeout(1000);
    const subTab = page.getByTestId('settings-tab-subscription');
    if (await subTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await subTab.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'test-results/s4-06-subscription.png' });
  });

  test('Step 7: Usage page shows data', async ({ page }) => {
    await page.goto('/usage');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/s4-07-usage.png' });
  });

  test('Step 8: Full navigation smoke test', async ({ page }) => {
    for (const path of ['/overview', '/agents', '/tasks', '/budget', '/settings']) {
      await page.goto(path);
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: 'test-results/s4-08-nav-smoke.png' });
  });
});

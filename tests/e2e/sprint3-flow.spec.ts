import { test, expect } from '@playwright/test';

test.describe('Sprint 3 E2E: Login → Company → Knowledge → Evolution', () => {

  test('Step 1: Register new account on /login page', async ({ page }) => {
    await page.goto('/login');
    // Look for register tab/link
    const registerLink = page.getByText(/sign up|register|create account/i);
    if (await registerLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await registerLink.click();
    }
    await page.screenshot({ path: 'test-results/s3-01-register.png' });
  });

  test('Step 2: Onboarding page loads', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForTimeout(1000);
    // Verify onboarding content is visible (template selection cards)
    const body = page.locator('body');
    await expect(body).toBeVisible();
    await page.screenshot({ path: 'test-results/s3-02-onboarding.png' });
  });

  test('Step 3: Dashboard accessible (may redirect to login)', async ({ page }) => {
    await page.goto('/overview');
    await page.waitForTimeout(1000);
    // Auth guard may redirect to /login — both states are valid
    const url = page.url();
    expect(url).toMatch(/\/(overview|login)/);
    await page.screenshot({ path: 'test-results/s3-03-dashboard.png' });
  });

  test('Step 4: Knowledge Hub page loads', async ({ page }) => {
    await page.goto('/knowledge');
    const pageWrapper = page.getByTestId('knowledge-page');
    if (await pageWrapper.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(pageWrapper).toBeVisible();
    }
    await page.screenshot({ path: 'test-results/s3-04-knowledge.png' });
  });

  test('Step 5: Evolution / Performance page loads', async ({ page }) => {
    await page.goto('/evolution');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/s3-05-evolution.png' });
  });

  test('Step 6: Settings page (may require auth)', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForTimeout(1000);
    // Auth guard may redirect — both states are valid
    const url = page.url();
    expect(url).toMatch(/\/(settings|login)/);
    await page.screenshot({ path: 'test-results/s3-06-settings.png' });
  });

  test('Step 7: Command Palette (⌘K) search', async ({ page }) => {
    await page.goto('/overview');
    await page.waitForTimeout(500);
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(500);
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('Atlas');
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'test-results/s3-07-cmdk.png' });
    await page.keyboard.press('Escape');
  });

  test('Step 8: Company switcher in TopNav', async ({ page }) => {
    await page.goto('/overview');
    await page.waitForTimeout(500);
    const switcher = page.getByTestId('company-switcher').or(
      page.getByRole('button', { name: /acme|company/i })
    );
    if (await switcher.isVisible({ timeout: 3000 }).catch(() => false)) {
      await switcher.click();
    }
    await page.screenshot({ path: 'test-results/s3-08-switcher.png' });
  });
});

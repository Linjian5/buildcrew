import { test, expect } from '@playwright/test';

test.describe('E2E Smoke Test', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');
    // Verify the page loaded — check for any visible content
    await expect(page).toHaveTitle(/.+/);
    // The page body should not be empty
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

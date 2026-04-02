import { test, expect } from '@playwright/test';
import { loginSeededUser } from './helpers/auth';

/**
 * Page navigation tests: verify every page loads without error.
 */
test.describe('Page Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginSeededUser(page);
  });

  const pages = [
    '/overview',
    '/chat',
    '/agents',
    '/tasks',
    '/budget',
    '/guardian',
    '/knowledge',
    '/smart-router',
    '/evolution',
    '/settings',
    '/org-chart',
    '/companies',
  ];

  for (const p of pages) {
    test(`Page ${p} loads without error`, async ({ page }) => {
      const errors500: string[] = [];
      page.on('response', (response) => {
        if (response.status() >= 500) {
          errors500.push(`${response.status()} ${response.url()}`);
        }
      });

      await page.goto(p);
      await page.waitForLoadState('networkidle');

      // Should not be redirected to login
      expect(page.url()).not.toContain('/login');

      // Page should have content
      const body = await page.locator('body').textContent();
      expect(body?.length).toBeGreaterThan(0);

      // No 500 errors
      expect(errors500).toHaveLength(0);
    });
  }
});

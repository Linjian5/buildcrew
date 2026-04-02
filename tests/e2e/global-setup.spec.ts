import { test, expect } from '@playwright/test';

test('Backend health check', async ({ request }) => {
  const res = await request.get('http://localhost:3100/api/v1/health');
  expect(res.status()).toBe(200);
});

test('Frontend loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/.+/);
});

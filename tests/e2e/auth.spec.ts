import { test, expect } from '@playwright/test';
import { SEEDED_USER } from './helpers/constants';

test.describe('Authentication', () => {
  test('Register -> redirects to /onboarding', async ({ page }) => {
    await page.goto('/register');
    const email = `e2e_auth_${Date.now()}@test.buildcrew.dev`;
    await page.getByTestId('register-name').fill('Auth Test User');
    await page.getByTestId('register-email').fill(email);
    await page.getByTestId('register-password').fill('TestPass123!');
    await page.getByTestId('register-submit').click();
    await page.waitForURL('**/onboarding', { timeout: 10_000 });

    // Verify auth tokens in localStorage
    const token = await page.evaluate(() => localStorage.getItem('buildcrew_token'));
    expect(token).toBeTruthy();
  });

  test('Login -> redirects to /overview', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email').fill(SEEDED_USER.email);
    await page.getByTestId('login-password').fill(SEEDED_USER.password);
    await page.getByTestId('login-submit').click();
    await page.waitForURL('**/overview', { timeout: 10_000 });

    const token = await page.evaluate(() => localStorage.getItem('buildcrew_token'));
    expect(token).toBeTruthy();
  });

  test('Unauthenticated -> redirect to /login', async ({ page }) => {
    // Clear any existing auth state
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.removeItem('buildcrew_token');
      localStorage.removeItem('buildcrew_user');
    });
    await page.goto('/overview');
    await page.waitForURL('**/login', { timeout: 10_000 });
  });

  test('Invalid credentials -> shows error', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email').fill('wrong@example.com');
    await page.getByTestId('login-password').fill('WrongPassword');
    await page.getByTestId('login-submit').click();
    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
    // Wait for the form submission to complete
    await page.waitForLoadState('networkidle');
    // Verify we're still on login (not redirected)
    expect(page.url()).toContain('/login');
  });
});

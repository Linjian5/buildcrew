import { type Page } from '@playwright/test';
import { TEST_USER, SEEDED_USER } from './constants';

/** Register a new user and return to the page (lands on /onboarding) */
export async function registerNewUser(page: Page) {
  await page.goto('/register');
  await page.getByTestId('register-name').fill(TEST_USER.name);
  await page.getByTestId('register-email').fill(TEST_USER.email);
  await page.getByTestId('register-password').fill(TEST_USER.password);
  await page.getByTestId('register-submit').click();
  await page.waitForURL('**/onboarding', { timeout: 10_000 });
}

/** Login with seeded user (lands on /overview) */
export async function loginSeededUser(page: Page) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(SEEDED_USER.email);
  await page.getByTestId('login-password').fill(SEEDED_USER.password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/overview', { timeout: 10_000 });
}

/** Save auth state for reuse across tests */
export async function saveAuthState(page: Page, path: string) {
  await page.context().storageState({ path });
}

import { test, expect } from '@playwright/test';
import { TEST_COMPANY } from './helpers/constants';
import { OnboardingPage } from './pages/OnboardingPage';

/**
 * Main Flow: Register -> Onboarding -> Chat with Aria -> Launch -> Execute -> Overview -> Verify
 *
 * Single test with test.step() to share page context across all steps.
 * Each step is visible in the HTML reporter for debugging.
 */
test.describe('Main Flow', () => {

  test('Complete user journey: Register -> Onboarding -> Execute -> Overview -> Chat', async ({ page }) => {

    await test.step('Step 1: Register new account', async () => {
      const email = `e2e_flow_${Date.now()}@test.buildcrew.dev`;
      await page.goto('/register');
      await page.getByTestId('register-name').fill('Flow Test User');
      await page.getByTestId('register-email').fill(email);
      await page.getByTestId('register-password').fill('TestPass123!');
      await page.getByTestId('register-submit').click();
      await page.waitForURL('**/onboarding', { timeout: 10_000 });
      expect(page.url()).toContain('/onboarding');
    });

    await test.step('Step 2: Company Setup (Onboarding Step 1)', async () => {
      const ob = new OnboardingPage(page);

      // Verify step 1 UI is visible
      await expect(ob.companyNameInput).toBeVisible({ timeout: 5_000 });
      await expect(ob.missionTextarea).toBeVisible();

      // Fill company info
      await ob.fillCompanyInfo(TEST_COMPANY.name, TEST_COMPANY.mission);

      // Select first template (saas)
      await ob.selectTemplate('saas');

      // Go to step 2
      await ob.goToStep2();

      // Verify step 2 chat is visible
      await expect(ob.chatInput).toBeVisible({ timeout: 10_000 });
    });

    await test.step('Step 3: Chat with Aria', async () => {
      const ob = new OnboardingPage(page);

      // Wait for Aria's first message to appear in the messages container
      await expect(ob.messages).toBeVisible({ timeout: 15_000 });
      const assistantMsg = ob.messages.locator('div').filter({ hasText: /Welcome|vision|product/i }).first();
      await expect(assistantMsg).toBeVisible({ timeout: 15_000 });

      // Send first user message
      await ob.sendMessage('I want to build an AI SaaS platform');
      await ob.waitForAriaReply();

      // Verify there are messages now
      const messageCount = await ob.messages.locator('> div').count();
      expect(messageCount).toBeGreaterThanOrEqual(3);
    });

    await test.step('Step 4: Launch plan', async () => {
      const ob = new OnboardingPage(page);

      // Send another message to ensure roundCount >= 1
      await ob.sendMessage('Target customers are tech startups, timeline is 4 weeks');
      await ob.waitForAriaReply();

      // Verify launch button appears
      await expect(ob.launchButton).toBeVisible({ timeout: 10_000 });

      // Click launch
      await ob.clickLaunch();

      // Wait for status text (confirming/executing)
      await expect(ob.statusText).toBeVisible({ timeout: 15_000 });

      // Wait for execute button to appear (plan ready)
      await expect(ob.executeButton).toBeVisible({ timeout: 30_000 });
    });

    await test.step('Step 5: Execute plan -> Overview', async () => {
      const ob = new OnboardingPage(page);

      // Click execute
      await ob.clickExecute();

      // Wait for redirect to overview
      await page.waitForURL('**/overview', { timeout: 30_000 });
      expect(page.url()).toContain('/overview');
    });

    await test.step('Step 6: Verify Overview data', async () => {
      // Verify overview page loaded
      await expect(page.getByTestId('overview-page')).toBeVisible({ timeout: 10_000 });

      // Verify stat cards are visible
      await expect(page.getByTestId('overview-stat-agents')).toBeVisible();
      await expect(page.getByTestId('overview-stat-tasks')).toBeVisible();

      // Verify agent count > 1 (CEO + hired agents)
      const agentText = await page.getByTestId('overview-stat-agents').locator('.text-3xl').textContent();
      const agentCount = parseInt(agentText ?? '0', 10);
      expect(agentCount).toBeGreaterThan(1);

      // Verify task count > 0
      const taskText = await page.getByTestId('overview-stat-tasks').locator('.text-3xl').textContent();
      const taskCount = parseInt(taskText ?? '0', 10);
      expect(taskCount).toBeGreaterThan(0);
    });

    await test.step('Step 7: Chat page - verify executed message has no button', async () => {
      // Navigate to chat
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      // Wait for sidebar to load
      const sidebar = page.getByTestId('chat-sidebar');
      await expect(sidebar).toBeVisible({ timeout: 10_000 });

      // Click on the first conversation (CEO thread)
      const firstConvo = sidebar.locator('button').first();
      if (await firstConvo.isVisible()) {
        await firstConvo.click();

        // Wait for messages to load
        await expect(page.getByTestId('chat-messages')).toBeVisible({ timeout: 10_000 });

        // Bug #22: verify NO execute button on executed messages
        const executeBtn = page.getByTestId('chat-execute-btn');
        await expect(executeBtn).toBeHidden({ timeout: 5_000 });

        // Reload and verify again
        await page.reload();
        await page.waitForLoadState('networkidle');
        await expect(page.getByTestId('chat-messages')).toBeVisible({ timeout: 10_000 });
        await expect(executeBtn).toBeHidden({ timeout: 5_000 });
      }
    });

  });
});

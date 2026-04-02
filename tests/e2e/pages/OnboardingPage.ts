import { type Page, type Locator, expect } from '@playwright/test';

export class OnboardingPage {
  readonly page: Page;
  // Step 1
  readonly companyNameInput: Locator;
  readonly missionTextarea: Locator;
  readonly nextButton: Locator;
  readonly skipLink: Locator;
  // Step 2
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly launchButton: Locator;
  readonly executeButton: Locator;
  readonly adjustButton: Locator;
  readonly messages: Locator;
  readonly statusText: Locator;

  constructor(page: Page) {
    this.page = page;
    // Step 1
    this.companyNameInput = page.getByTestId('onboarding-company-name');
    this.missionTextarea = page.getByTestId('onboarding-mission');
    this.nextButton = page.getByTestId('onboarding-next');
    this.skipLink = page.getByTestId('onboarding-skip');
    // Step 2
    this.chatInput = page.getByTestId('onboarding-chat-input');
    this.sendButton = page.getByTestId('onboarding-send');
    this.launchButton = page.getByTestId('onboarding-launch');
    this.executeButton = page.getByTestId('onboarding-execute');
    this.adjustButton = page.getByTestId('onboarding-adjust');
    this.messages = page.getByTestId('onboarding-messages');
    this.statusText = page.getByTestId('onboarding-status');
  }

  async fillCompanyInfo(name: string, mission: string) {
    await this.companyNameInput.fill(name);
    await this.missionTextarea.fill(mission);
  }

  async selectTemplate(templateId: string) {
    await this.page.getByTestId(`onboarding-template-${templateId}`).click();
  }

  async goToStep2() {
    await this.nextButton.click();
  }

  async sendMessage(text: string) {
    await this.chatInput.fill(text);
    await this.sendButton.click();
  }

  async waitForAriaReply() {
    // Wait until typing indicator appears then disappears (reply complete)
    const spinner = this.page.locator('.animate-spin');
    // First wait for spinner to appear (message being generated)
    await spinner.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {
      // Spinner may have already appeared and disappeared — that's ok
    });
    // Then wait for it to disappear (reply complete)
    await expect(spinner).toBeHidden({ timeout: 15_000 });
  }

  async clickLaunch() {
    await this.launchButton.click();
  }

  async clickExecute() {
    await this.executeButton.click();
  }
}

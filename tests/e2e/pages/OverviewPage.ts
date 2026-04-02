import { type Page, type Locator } from '@playwright/test';

export class OverviewPage {
  readonly page: Page;
  readonly pageWrapper: Locator;
  readonly agentCountCard: Locator;
  readonly taskCountCard: Locator;
  readonly spendCard: Locator;
  readonly guardianCard: Locator;
  readonly ariaSummaryCard: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageWrapper = page.getByTestId('overview-page');
    this.agentCountCard = page.getByTestId('overview-stat-agents');
    this.taskCountCard = page.getByTestId('overview-stat-tasks');
    this.spendCard = page.getByTestId('overview-stat-spend');
    this.guardianCard = page.getByTestId('overview-stat-guardian');
    this.ariaSummaryCard = page.getByTestId('overview-aria-card');
  }

  async goto() {
    await this.page.goto('/overview');
  }

  async isVisible(): Promise<boolean> {
    return this.pageWrapper.isVisible();
  }

  async getAgentCount(): Promise<number> {
    const text = await this.agentCountCard.locator('.text-3xl').textContent();
    return parseInt(text ?? '0', 10);
  }

  async getTaskCount(): Promise<number> {
    const text = await this.taskCountCard.locator('.text-3xl').textContent();
    return parseInt(text ?? '0', 10);
  }
}

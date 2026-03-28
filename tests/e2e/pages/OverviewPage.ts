import { type Page, type Locator } from '@playwright/test';

export class OverviewPage {
  readonly page: Page;
  readonly pageWrapper: Locator;
  readonly statCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageWrapper = page.getByTestId('overview-page');
    // Stat cards contain text like "Active Agents", "Tasks Today", etc.
    // They're inside the overview-page wrapper as the first grid row
    this.statCards = page.getByTestId('overview-page').locator('text=/Active Agents|Tasks Today|Daily Spend|Guardian Alerts/');
  }

  async goto() {
    await this.page.goto('/');
  }

  async isVisible() {
    return this.pageWrapper.isVisible();
  }
}

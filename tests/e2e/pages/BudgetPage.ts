import { type Page, type Locator } from '@playwright/test';

export class BudgetPage {
  readonly page: Page;
  readonly pageWrapper: Locator;
  readonly budgetTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageWrapper = page.getByTestId('budget-page');
    this.budgetTable = page.getByTestId('budget-table');
  }

  async goto() {
    await this.page.goto('/budget');
  }

  async isVisible() {
    return this.pageWrapper.isVisible();
  }
}

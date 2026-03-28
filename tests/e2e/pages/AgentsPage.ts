import { type Page, type Locator } from '@playwright/test';

export class AgentsPage {
  readonly page: Page;
  readonly pageWrapper: Locator;
  readonly hireButton: Locator;
  readonly departmentFilter: Locator;
  readonly agentCards: Locator;

  // Hire dialog
  readonly hireDialog: Locator;
  readonly hireStep1: Locator;
  readonly hireStep2: Locator;
  readonly hireStep3: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageWrapper = page.getByTestId('agents-page');
    this.hireButton = page.getByTestId('hire-agent-btn');
    this.departmentFilter = page.getByTestId('agent-department-filter');
    this.agentCards = page.locator('[data-testid^="agent-card-"]');

    this.hireDialog = page.getByTestId('hire-agent-dialog');
    this.hireStep1 = page.getByTestId('hire-step-1');
    this.hireStep2 = page.getByTestId('hire-step-2');
    this.hireStep3 = page.getByTestId('hire-step-3');
  }

  async goto() {
    await this.page.goto('/agents');
  }

  async isVisible() {
    return this.pageWrapper.isVisible();
  }

  async openHireDialog() {
    await this.hireButton.click();
    await this.hireDialog.waitFor({ state: 'visible' });
  }

  async getAgentCount() {
    return this.agentCards.count();
  }

  agentCard(agentId: string) {
    return this.page.getByTestId(`agent-card-${agentId}`);
  }
}

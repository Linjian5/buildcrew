import { type Page, type Locator } from '@playwright/test';

/**
 * Helper for top-level navigation interactions.
 */
export class Navigation {
  readonly page: Page;
  readonly logo: Locator;
  readonly searchButton: Locator;
  readonly notificationsButton: Locator;
  readonly userMenuButton: Locator;
  readonly mobileMenuButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.logo = page.getByTestId('logo-link');
    this.searchButton = page.getByTestId('search-btn');
    this.notificationsButton = page.getByTestId('notifications-btn');
    this.userMenuButton = page.getByTestId('user-menu-btn');
    this.mobileMenuButton = page.getByTestId('mobile-menu-btn');
  }

  async navigateTo(tab: string) {
    await this.page.getByTestId(`nav-${tab}`).click();
  }

  navTab(tab: string) {
    return this.page.getByTestId(`nav-${tab}`);
  }
}

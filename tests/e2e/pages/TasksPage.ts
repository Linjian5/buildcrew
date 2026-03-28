import { type Page, type Locator } from '@playwright/test';

export class TasksPage {
  readonly page: Page;
  readonly pageWrapper: Locator;
  readonly searchInput: Locator;
  readonly createTaskButton: Locator;
  readonly filterButton: Locator;
  readonly kanbanBoard: Locator;
  readonly listView: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageWrapper = page.getByTestId('tasks-page');
    this.searchInput = page.getByTestId('task-search');
    this.createTaskButton = page.getByTestId('create-task-btn');
    this.filterButton = page.getByTestId('task-filter-btn');
    this.kanbanBoard = page.getByTestId('kanban-board');
    this.listView = page.getByTestId('list-view');
  }

  async goto() {
    await this.page.goto('/tasks');
  }

  async isVisible() {
    return this.pageWrapper.isVisible();
  }

  kanbanColumn(columnId: string) {
    return this.page.getByTestId(`kanban-column-${columnId}`);
  }

  taskCard(taskId: string) {
    return this.page.getByTestId(`task-card-${taskId}`);
  }

  async getColumnTaskCount(columnId: string) {
    const column = this.kanbanColumn(columnId);
    return column.locator('[data-testid^="task-card-"]').count();
  }

  async search(query: string) {
    await this.searchInput.fill(query);
  }
}

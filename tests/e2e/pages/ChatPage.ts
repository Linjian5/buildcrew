import { type Page, type Locator } from '@playwright/test';

export class ChatPage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly messageList: Locator;
  readonly executeButtons: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.getByTestId('chat-sidebar');
    this.chatInput = page.getByTestId('chat-input');
    this.sendButton = page.getByTestId('chat-send');
    this.messageList = page.getByTestId('chat-messages');
    this.executeButtons = page.getByTestId('chat-execute-btn');
  }

  async goto() {
    await this.page.goto('/chat');
  }

  async selectConversation(index: number) {
    const rows = this.sidebar.locator('button');
    await rows.nth(index).click();
  }

  async sendMessage(text: string) {
    await this.chatInput.fill(text);
    await this.sendButton.click();
  }

  async hasExecuteButton(): Promise<boolean> {
    return this.executeButtons.isVisible().catch(() => false);
  }
}

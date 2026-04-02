import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false, // Main flow tests need sequential execution
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Shared database — cannot run in parallel
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 60_000, // Mock AI still needs time for backend flow

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
  },

  projects: [
    {
      name: 'setup',
      testMatch: /global-setup\.spec\.ts/,
    },
    {
      name: 'main',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'MOCK_AI=true pnpm --filter @buildcrew/server dev',
      port: 3100,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { MOCK_AI: 'true', NODE_ENV: 'test' },
    },
    {
      command: 'pnpm --filter @buildcrew/web dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});

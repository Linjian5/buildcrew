import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/acceptance/**/*.test.ts'],
    exclude: ['tests/acceptance/**/*.spec.ts'], // E2E handled by Playwright
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false, // Sequential to avoid DB conflicts
    reporters: ['verbose'],
    env: {
      DATABASE_URL: 'postgresql://localhost:5432/buildcrew_test',
      NODE_ENV: 'test',
    },
  },
});

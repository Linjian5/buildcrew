import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@buildcrew/shared': path.resolve(__dirname, 'packages/shared/src'),
      '@buildcrew/db': path.resolve(__dirname, 'packages/db/src'),
      '@server': path.resolve(__dirname, 'apps/server/src'),
    },
  },
  test: {
    globals: true,
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
    ],
    exclude: ['tests/e2e/**', 'node_modules', 'dist'],
    environment: 'node',
    env: {
      DATABASE_URL: 'postgresql://localhost:5432/buildcrew_test',
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'apps/server/src/**/*.ts',
        'packages/shared/src/**/*.ts',
        'packages/db/src/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/index.ts',
        '**/types/**',
      ],
      // Thresholds will be enforced once business code lands (Sprint 1+)
      // thresholds: {
      //   lines: 60,
      //   functions: 60,
      //   branches: 60,
      //   statements: 60,
      // },
    },
    // Integration tests share a DB — must run files sequentially
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});

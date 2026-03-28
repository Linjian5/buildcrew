/**
 * Centralized environment configuration.
 * All code should use `env.*` instead of reading `import.meta.env` directly.
 */
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3100/api/v1',
  wsBaseUrl: import.meta.env.VITE_WS_BASE_URL || 'http://localhost:3100',
} as const;

export * from './schema/index';
export { db } from './client';
export type { Database } from './client';

// Re-export drizzle helpers so consumers don't need a separate drizzle-orm dep
export { eq, and, or, not, sql, count, sum, avg, min, max, inArray, desc, asc } from 'drizzle-orm';
export type { SQL } from 'drizzle-orm';

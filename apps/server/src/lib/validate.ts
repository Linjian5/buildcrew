import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export function validate<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        },
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function parsePagination(query: Record<string, unknown>) {
  const result = paginationSchema.safeParse(query);
  if (result.success) return result.data;
  return { page: 1, limit: 20 };
}

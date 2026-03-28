import type { Response } from 'express';

export function ok<T>(res: Response, data: T, status = 200) {
  res.status(status).json({ data, error: null });
}

export function paginated<T>(
  res: Response,
  data: T[],
  meta: { page: number; limit: number; total: number },
) {
  res.json({ data, meta, error: null });
}

export function err(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ data: null, error: { code, message } });
}

export function notFound(res: Response, entity: string) {
  err(res, 404, 'NOT_FOUND', `${entity} not found`);
}

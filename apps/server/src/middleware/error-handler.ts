import type { ErrorRequestHandler } from 'express';

export interface ApiErrorBody {
  data: null;
  error: {
    code: string;
    message: string;
  };
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // B002 fix: handle PostgreSQL FK violation (23503) and invalid UUID syntax (22P02)
  const pgCode = err.code as string | undefined;

  if (pgCode === '23503') {
    // Foreign key violation
    res.status(400).json({
      data: null,
      error: { code: 'FK_VIOLATION', message: 'Referenced entity does not exist' },
    } satisfies ApiErrorBody);
    return;
  }

  if (pgCode === '22P02') {
    // Invalid text representation (e.g., invalid UUID format in SQL)
    res.status(400).json({
      data: null,
      error: { code: 'INVALID_INPUT', message: 'Invalid input syntax' },
    } satisfies ApiErrorBody);
    return;
  }

  const status = typeof err.status === 'number' ? err.status : 500;
  const message = err.message ?? 'Internal Server Error';
  const code = pgCode ?? 'INTERNAL_ERROR';

  res.status(status).json({
    data: null,
    error: { code, message },
  } satisfies ApiErrorBody);
};

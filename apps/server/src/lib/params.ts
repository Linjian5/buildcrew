import type { Request } from 'express';

/** Safely extract a string route param */
export function param(req: Request, name: string): string {
  const val = req.params[name];
  if (typeof val === 'string') return val;
  throw new Error(`Missing route param: ${name}`);
}

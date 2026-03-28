import type { Request, Response, NextFunction } from 'express';
import { eq, and } from '@buildcrew/db';
import { db, companies } from '@buildcrew/db';
import { getUser } from './auth.js';

/**
 * Validates that the company identified by :companyId or :id belongs to the
 * authenticated user. Returns 404 if not found or not owned.
 */
export async function validateCompanyOwnership(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = req.params['companyId'] ?? req.params['id'];
    if (!companyId || typeof companyId !== 'string') {
      return next(); // no company param, skip
    }

    const userId = getUser(req).userId;
    const [company] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, companyId), eq(companies.userId, userId)));

    if (!company) {
      res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Company not found' },
      });
      return;
    }

    // Attach company to request for downstream use
    (req as Request & { company: typeof company }).company = company;
    next();
  } catch {
    next();
  }
}

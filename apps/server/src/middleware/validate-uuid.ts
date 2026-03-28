import type { Request, Response, NextFunction } from 'express';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Middleware that validates specified route params are valid UUIDs.
 * Returns 400 if any param is present but not a valid UUID format.
 */
export function validateUuidParams(...paramNames: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const name of paramNames) {
      const val = req.params[name];
      if (typeof val === 'string' && !UUID_REGEX.test(val)) {
        res.status(400).json({
          data: null,
          error: {
            code: 'INVALID_UUID',
            message: `Parameter '${name}' must be a valid UUID, got '${val}'`,
          },
        });
        return;
      }
    }
    next();
  };
}

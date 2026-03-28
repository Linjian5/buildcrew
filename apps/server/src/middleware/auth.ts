import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';

const JWT_SECRET = env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRY = '24h'; // Extended: 15m was too aggressive for SPA, causes constant 401s
const REFRESH_TOKEN_EXPIRY = '30d';

export interface JwtPayload {
  userId: string;
  email: string;
}

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' } });
    return;
  }

  try {
    const token = header.slice(7);
    const decoded = verifyToken(token);
    (req as Request & { user: JwtPayload }).user = decoded;
    next();
  } catch {
    res.status(401).json({ data: null, error: { code: 'TOKEN_EXPIRED', message: 'Invalid or expired token' } });
  }
}

export function getUser(req: Request): JwtPayload {
  return (req as Request & { user: JwtPayload }).user;
}

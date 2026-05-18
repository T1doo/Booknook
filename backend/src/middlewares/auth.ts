/**
 * JWT 鉴权中间件
 * 优先读取 HttpOnly Cookie,其次读取 Authorization: Bearer
 */
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { verifyToken, type TokenPayload } from '../utils/jwt.js';
import { Err } from '../utils/http.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: TokenPayload;
  }
}

export function authRequired(req: Request, _res: Response, next: NextFunction): void {
  const fromCookie = req.cookies?.[env.COOKIE_NAME];
  const fromHeader = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const token = fromCookie || fromHeader;

  if (!token) throw Err.unauthorized();

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    throw Err.unauthorized('Token 无效或已过期');
  }
}

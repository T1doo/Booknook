/**
 * JWT 鉴权中间件
 *
 * - 优先读取 HttpOnly Cookie, 其次读取 Authorization: Bearer
 * - 实时校验 is_active (C3): 软删除用户的 token 必须立即失效.
 *   为避免每个请求都查 DB, 加 30s 短缓存; 缓存 miss 才查库.
 *   30s 内被禁用的用户最多还能多调几次, 业务上可接受, 演示口径"近实时失效".
 */
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { verifyToken, type TokenPayload } from '../utils/jwt.js';
import { Err } from '../utils/http.js';
import { prisma } from '../config/db.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: TokenPayload;
  }
}

const ACTIVE_CACHE = new Map<string, { active: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

async function isActive(uid: string): Promise<boolean> {
  const now = Date.now();
  const cached = ACTIVE_CACHE.get(uid);
  if (cached && cached.expiresAt > now) return cached.active;
  const u = await prisma.user.findUnique({
    where: { id: BigInt(uid) },
    select: { is_active: true },
  });
  const active = !!u?.is_active;
  ACTIVE_CACHE.set(uid, { active, expiresAt: now + CACHE_TTL_MS });
  return active;
}

export async function authRequired(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const fromCookie = req.cookies?.[env.COOKIE_NAME];
  const fromHeader = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const token = fromCookie || fromHeader;

  if (!token) throw Err.unauthorized();

  let payload: TokenPayload;
  try {
    payload = verifyToken(token);
  } catch {
    throw Err.unauthorized('Token 无效或已过期');
  }

  if (!(await isActive(payload.uid))) {
    throw Err.unauthorized('账号已被停用');
  }

  req.user = payload;
  next();
}

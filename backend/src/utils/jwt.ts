/**
 * JWT 签发与校验
 *
 * 算法显式锁定为 HS256 (C2), 防御 alg=none / RS-HS 混淆等 token 伪造攻击.
 */
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type TokenPayload = {
  uid: string;
  username: string;
  role: 'super_admin' | 'admin';
};

const ALGO: jwt.Algorithm = 'HS256';

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    algorithm: ALGO,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGO] }) as TokenPayload;
}

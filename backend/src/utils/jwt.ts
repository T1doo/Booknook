/**
 * JWT 签发与校验
 */
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type TokenPayload = {
  uid: string;
  username: string;
  role: 'super_admin' | 'admin';
};

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}

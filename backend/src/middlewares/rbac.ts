/**
 * 角色守卫: 必须先经过 authRequired
 */
import type { Request, Response, NextFunction } from 'express';
import { Err } from '../utils/http.js';

export function requireRole(...roles: Array<'super_admin' | 'admin'>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw Err.unauthorized();
    if (!roles.includes(req.user.role)) throw Err.forbidden();
    next();
  };
}

export const requireSuperAdmin = requireRole('super_admin');

/**
 * 全局错误处理 (必须放在所有路由之后)
 */
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http.js';
import { logger } from '../config/logger.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ code: err.code, data: null, message: err.message });
    return;
  }
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    code: 5000,
    data: null,
    message: err instanceof Error ? err.message : '服务器内部错误',
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ code: 4004, data: null, message: '路由不存在' });
}

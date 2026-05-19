/**
 * 全局错误处理 (必须放在所有路由之后)
 *
 * - 业务异常 (HttpError) 透传
 * - Prisma 已知错误码映射到合适 HTTP 状态 (C9)
 * - JSON 解析错误 / 参数类型错 -> 400
 * - 其余视为服务器错误: 开发环境返回原始 message, 生产环境只返回脱敏文案
 */
import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { HttpError } from '../utils/http.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

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

  // Prisma 已知错误码 → 合适的 HTTP 状态 (C9)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ code: 4009, data: null, message: '记录已存在 (唯一约束冲突)' });
      return;
    }
    if (err.code === 'P2003') {
      res.status(400).json({ code: 4000, data: null, message: '关联记录不存在' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ code: 4004, data: null, message: '资源不存在' });
      return;
    }
  }

  // BigInt('abc') / 路径参数 / JSON.parse 类的语法错 → 400 (F5)
  if (err instanceof SyntaxError) {
    res.status(400).json({ code: 4000, data: null, message: '请求参数格式错误' });
    return;
  }

  // 兜底: 服务器错误
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    code: 5000,
    data: null,
    message: env.isDev && err instanceof Error ? err.message : '服务器内部错误',
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ code: 4004, data: null, message: '路由不存在' });
}

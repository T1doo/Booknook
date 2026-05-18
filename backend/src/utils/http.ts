/**
 * 统一 HTTP 响应格式与业务错误
 */
import type { Response } from 'express';

export type ApiResponse<T> = { code: number; data: T | null; message: string };

export function ok<T>(res: Response, data: T, message = 'OK', code = 0): void {
  res.json({ code, data, message } as ApiResponse<T>);
}

export function created<T>(res: Response, data: T, message = 'Created'): void {
  res.status(201).json({ code: 0, data, message } as ApiResponse<T>);
}

export class HttpError extends Error {
  constructor(public readonly status: number, public readonly code: number, message: string) {
    super(message);
  }
}

export const Err = {
  badRequest:  (msg: string) => new HttpError(400, 4000, msg),
  unauthorized:(msg = '请先登录')   => new HttpError(401, 4001, msg),
  forbidden:   (msg = '没有权限')   => new HttpError(403, 4003, msg),
  notFound:    (msg = '资源不存在') => new HttpError(404, 4004, msg),
  conflict:    (msg: string) => new HttpError(409, 4009, msg),
  unprocessable:(msg: string)=> new HttpError(422, 4220, msg),
  internal:    (msg = '服务器错误') => new HttpError(500, 5000, msg),
};

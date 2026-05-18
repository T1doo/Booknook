/**
 * Zod 校验中间件 (body / query / params)
 */
import type { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { Err } from '../utils/http.js';

type Source = 'body' | 'query' | 'params';

export function validate<T>(source: Source, schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const detail = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      throw Err.unprocessable(`参数校验失败 → ${detail}`);
    }
    // 覆盖原始字段为解析后的值 (含 transform 结果)
    (req as Record<Source, unknown>)[source] = result.data;
    next();
  };
}

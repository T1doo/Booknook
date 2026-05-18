/**
 * 操作日志中间件: 拦截写操作,异步写入 operation_logs (加分项)
 */
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** 把 URL 转成 resource + action 描述 */
function parseRoute(req: Request): { action: string; resource: string; resourceId?: string } {
  // 去掉 /api 前缀, e.g. /api/books/12 -> books/12
  const path = req.path.replace(/^\/?api\//, '');
  const parts = path.split('/').filter(Boolean);
  const resource = parts[0] || 'unknown';
  const second = parts[1];

  // /api/purchases/123/pay -> resource=purchases, resourceId=123, action=pay
  if (parts.length >= 3) {
    return { resource, resourceId: second, action: parts[2] };
  }

  const map: Record<string, string> = { POST: 'create', PATCH: 'update', PUT: 'update', DELETE: 'delete' };
  const action = map[req.method] ?? req.method.toLowerCase();
  return { resource, resourceId: /^\d+$/.test(second ?? '') ? second : undefined, action };
}

export function auditLog(req: Request, res: Response, next: NextFunction): void {
  if (!WRITE_METHODS.has(req.method)) return next();
  // login / logout 不会跑到这里(它们没有 authRequired 前置),所以特殊路径单独写
  res.on('finish', () => {
    // 只记录 2xx/3xx 成功操作
    if (res.statusCode >= 400) return;
    const { action, resource, resourceId } = parseRoute(req);
    prisma.operationLog
      .create({
        data: {
          user_id: req.user ? BigInt(req.user.uid) : null,
          action,
          resource,
          resource_id: resourceId ?? null,
          ip: (req.ip ?? '').slice(0, 45),
          user_agent: req.headers['user-agent']?.slice(0, 1000) ?? null,
          payload: scrubPayload(req.body),
        },
      })
      .catch((e) =>
        logger.error(
          { err: e, method: req.method, url: req.originalUrl },
          'audit log write failed',
        ),
      );
  });
  next();
}

const SENSITIVE_RE =
  /password|passwd|secret|token|api[_-]?key|credential|authorization|access[_-]?key/i;

/** 脱敏: 删掉密码 / 凭据等字段 (递归一层处理嵌套对象) */
function scrubPayload(body: unknown): object {
  if (body == null || typeof body !== 'object') return {};
  const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  for (const k of Object.keys(clone)) {
    if (SENSITIVE_RE.test(k)) {
      clone[k] = '***';
      continue;
    }
    const v = clone[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const inner: Record<string, unknown> = { ...(v as Record<string, unknown>) };
      for (const ik of Object.keys(inner)) {
        if (SENSITIVE_RE.test(ik)) inner[ik] = '***';
      }
      clone[k] = inner;
    }
  }
  return clone;
}

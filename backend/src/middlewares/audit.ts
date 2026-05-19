/**
 * 操作日志中间件: 拦截写操作,异步写入 operation_logs (加分项)
 */
import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** 把 URL 转成 resource + action 描述. 注意: 必须用 req.originalUrl, 因为
 *  子路由 mount 时 Express 会临时修改 req.path / req.url, 且子路由若不 next()
 *  就不会恢复, 导致 res.on('finish') 回调里读到的 path 已经是 '/3' 而非 '/books/3'.
 */
function parseRoute(req: Request): { action: string; resource: string; resourceId?: string } {
  // originalUrl 形如 '/api/books/3?from=x', 取 pathname 后去掉 '/api/' 前缀
  const url = (req.originalUrl || req.url).split('?')[0];
  const path = url.replace(/^\/?api\//, '');
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
  // login / logout 不会跑到这里(它们没有 authRequired 前置),所以特殊路径单独写.
  // 在 next() 前先把路由信息提取并缓存到本闭包, 避免子路由 mount 后污染 req.path.
  const routeInfo = parseRoute(req);
  res.on('finish', () => {
    // 只记录 2xx/3xx 成功操作
    if (res.statusCode >= 400) return;
    const { action, resource, resourceId } = routeInfo;
    // C14: 若 controller 在执行前埋了 auditBefore (例如 books PATCH 的原值快照),
    //      把 before + after 一并写入 payload, 形成完整变更追溯链.
    const auditBefore = (req as Request & { auditBefore?: Record<string, unknown> }).auditBefore;
    const after = scrubPayload(req.body);
    const payload = auditBefore ? { before: scrubPayload(auditBefore), after } : after;
    prisma.operationLog
      .create({
        data: {
          user_id: req.user ? BigInt(req.user.uid) : null,
          action,
          resource,
          resource_id: resourceId ?? null,
          ip: (req.ip ?? '').slice(0, 45),
          user_agent: req.headers['user-agent']?.slice(0, 1000) ?? null,
          payload: payload as Prisma.InputJsonValue,
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

/**
 * 脱敏: 深度递归遍历 (含数组), 任意层级的敏感字段都替换为 ***  (C13)
 *
 * 防御场景: {items: [{password: 'x'}]} 这类嵌套结构原先漏脱敏.
 */
function scrubPayload(body: unknown): unknown {
  if (body == null || typeof body !== 'object') return body ?? {};
  return scrubDeep(body);
}

function scrubDeep(value: unknown): unknown {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(scrubDeep);
  const clone: Record<string, unknown> = {};
  for (const k of Object.keys(value as Record<string, unknown>)) {
    if (SENSITIVE_RE.test(k)) {
      clone[k] = '***';
    } else {
      clone[k] = scrubDeep((value as Record<string, unknown>)[k]);
    }
  }
  return clone;
}

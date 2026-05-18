/**
 * 操作日志查询 (仅超管, 加分项)
 *  GET /logs?user=&action=&resource=&from=&to=
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { ok } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { requireSuperAdmin } from '../../middlewares/rbac.js';

const router = Router();
router.use(requireSuperAdmin);

const listQuery = z.object({
  user_id:  z.coerce.number().optional(),
  action:   z.string().optional(),
  resource: z.string().optional(),
  from:     z.string().optional(),
  to:       z.string().optional(),
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

router.get('/', validate('query', listQuery), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof listQuery>;
  const where: Record<string, unknown> = {};
  if (q.user_id) where.user_id = BigInt(q.user_id);
  if (q.action)   where.action = q.action;
  if (q.resource) where.resource = q.resource;
  if (q.from || q.to) {
    where.created_at = {
      ...(q.from ? { gte: new Date(q.from) } : {}),
      ...(q.to   ? { lte: new Date(q.to)   } : {}),
    };
  }
  const [total, list] = await Promise.all([
    prisma.operationLog.count({ where }),
    prisma.operationLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { user: { select: { username: true, real_name: true } } },
    }),
  ]);
  ok(res, { total, page: q.page, pageSize: q.pageSize, list });
});

export default router;

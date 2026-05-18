/**
 * 财务流水 (PPT 10/11)
 * GET /transactions  按日期 / 类型筛选 + 汇总
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { ok } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';

const router = Router();

const listQuery = z.object({
  type: z.enum(['income', 'expense']).optional(),
  from: z.string().optional(),
  to:   z.string().optional(),
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

router.get('/', validate('query', listQuery), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof listQuery>;
  const where: Record<string, unknown> = {};
  if (q.type) where.type = q.type;
  if (q.from || q.to) {
    where.created_at = {
      ...(q.from ? { gte: new Date(q.from) } : {}),
      ...(q.to   ? { lte: new Date(q.to)   } : {}),
    };
  }

  const [total, list, agg] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { user: { select: { username: true, real_name: true } } },
    }),
    prisma.transaction.groupBy({
      by: ['type'],
      where,
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const summary = {
    income:  Number(agg.find((a) => a.type === 'income')?._sum.amount ?? 0),
    expense: Number(agg.find((a) => a.type === 'expense')?._sum.amount ?? 0),
    income_count:  agg.find((a) => a.type === 'income')?._count._all ?? 0,
    expense_count: agg.find((a) => a.type === 'expense')?._count._all ?? 0,
  };
  ok(res, { total, page: q.page, pageSize: q.pageSize, list, summary });
});

export default router;

/**
 * 库存预警 (加分项)
 *  GET    /alerts        当前未解决预警
 *  POST   /alerts/:id/resolve  手动解决
 *  PATCH  /alerts/threshold/:bookId  修改某书的阈值
 */
import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { ok, Err } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';

const router = Router();

router.get('/', async (_req, res) => {
  const list = await prisma.inventoryAlert.findMany({
    where: { resolved: false },
    orderBy: { last_alerted_at: 'desc' },
    include: { book: true },
  });
  ok(res, list);
});

router.post('/:id/resolve', async (req, res) => {
  const id = BigInt(req.params.id);
  const alert = await prisma.inventoryAlert.findUnique({ where: { id } });
  if (!alert) throw Err.notFound();
  await prisma.inventoryAlert.update({
    where: { id },
    data:  { resolved: true, resolved_at: new Date() },
  });
  ok(res, null, '已标记为已处理');
});

const thresholdSchema = z.object({
  // 阈值上限 10000, 防止恶意设置极大值刷爆 inventory_alerts (F8)
  low_stock_threshold: z.coerce.number().int().nonnegative().max(10000),
});

router.patch('/threshold/:bookId', validate('body', thresholdSchema), async (req, res) => {
  const bookId = BigInt(req.params.bookId as string);
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) throw Err.notFound('书籍不存在');
  const updated = await prisma.book.update({
    where: { id: bookId },
    data:  { low_stock_threshold: (req.body as z.infer<typeof thresholdSchema>).low_stock_threshold },
  });
  // 重新评估: 用 $executeRaw 而非 $queryRaw, 因为函数返回 VOID 没有结果集.
  // 用 Prisma.sql 模板字面量参数化, 杜绝 SQL 注入风险 (C7).
  // 注: 数据库的 trg_books_after_update_check_alert 触发器也会自动评估,
  //     这里的显式调用是应用层防御性兜底 (重复调用幂等无害).
  await prisma.$executeRaw(Prisma.sql`SELECT fn_books_low_stock_check(${bookId})`);
  ok(res, updated, '已更新阈值');
});

export default router;

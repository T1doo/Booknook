/**
 * 销售模块 (PPT 9)
 *  POST /sales         一次性结账,扣库存 + 写流水 (触发器)
 *  GET  /sales         销售单列表
 *  GET  /sales/:id     详情
 */
import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { ok, created, Err } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';

const router = Router();

// ──────────── GET /sales ────────────────────────────────────────────────────
const listQuery = z.object({
  q:        z.string().optional(),
  from:     z.string().datetime().optional(),
  to:       z.string().datetime().optional(),
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

router.get('/', validate('query', listQuery), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof listQuery>;
  const where: Record<string, unknown> = {};
  if (q.q) where.order_no = { contains: q.q, mode: 'insensitive' };
  if (q.from || q.to) {
    where.created_at = {
      ...(q.from ? { gte: new Date(q.from) } : {}),
      ...(q.to   ? { lte: new Date(q.to)   } : {}),
    };
  }
  const [total, list] = await Promise.all([
    prisma.saleOrder.count({ where }),
    prisma.saleOrder.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: {
        user:  { select: { username: true, real_name: true } },
        _count:{ select: { items: true } },
      },
    }),
  ]);
  ok(res, { total, page: q.page, pageSize: q.pageSize, list });
});

// ──────────── GET /sales/:id ────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const id = BigInt(req.params.id);
  const so = await prisma.saleOrder.findUnique({
    where: { id },
    include: {
      items: { include: { book: { select: { id: true, isbn: true, title: true, author: true } } } },
      user:  { select: { username: true, real_name: true } },
    },
  });
  if (!so) throw Err.notFound('销售单不存在');
  ok(res, so);
});

// ──────────── POST /sales (结账) ────────────────────────────────────────────
const itemSchema = z.object({
  book_id:  z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
});

const createSchema = z.object({
  customer_note: z.string().max(100).optional(),
  items:         z.array(itemSchema).min(1, '至少一项销售明细'),
});

router.post('/', validate('body', createSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createSchema>;
  const bookIds = body.items.map((i) => BigInt(i.book_id));

  const so = await prisma.$transaction(async (tx) => {
    // 行级锁: 锁定本次涉及的所有 book 行, 防止并发结账时双方都通过库存校验
    // 第二个事务会阻塞在这里, 等本事务提交后再读到最新 stock, 从而抛准确的"库存不足"
    const locked = await tx.$queryRaw<
      Array<{ id: bigint; title: string; stock: number; retail_price: string }>
    >`SELECT id, title, stock, retail_price
        FROM books
       WHERE id IN (${Prisma.join(bookIds)})
       FOR UPDATE`;
    const map = new Map(locked.map((b) => [b.id.toString(), b]));

    // 用字符串 + 简单累加做小数运算, 避免 JS Number 浮点累积误差 (B6).
    // PG 数值字段是 NUMERIC(10,2), 这里也按"分"为整数做累加更稳.
    let totalCents = 0n;
    for (const it of body.items) {
      const b = map.get(BigInt(it.book_id).toString());
      if (!b) throw Err.badRequest(`书籍 ${it.book_id} 不存在`);
      if (b.stock < it.quantity) {
        throw Err.badRequest(`《${b.title}》库存不足 (当前 ${b.stock}, 需要 ${it.quantity})`);
      }
      // retail_price 形如 "35.00", 转成分级整数 (BigInt) 避免浮点
      const priceCents = BigInt(Math.round(Number(b.retail_price) * 100));
      totalCents += priceCents * BigInt(it.quantity);
    }
    const total = (Number(totalCents) / 100).toFixed(2);

    const [{ order_no }] = await tx.$queryRaw<{ order_no: string }[]>`
      SELECT gen_order_no('SO') AS order_no`;

    const order = await tx.saleOrder.create({
      data: {
        order_no,
        created_by:    BigInt(req.user!.uid),
        customer_note: body.customer_note,
        total_amount:  total,
      },
    });

    // BATCH INSERT items: 必须一次 statement 完成, 配合 fn_sale_items_after_insert_stmt
    // statement-level 触发器一次性按 SUM(subtotal) 写入 income 流水.
    // 行级触发器 fn_sales_after_insert 仍会对每个 row 扣库存并检查预警.
    // 单价直接用 Prisma.Decimal 包装, 全程参数化, 杜绝 SQL 注入与浮点误差.
    const valuesSql = body.items.map((it) => {
      const b = map.get(BigInt(it.book_id).toString())!;
      return Prisma.sql`(${order.id}, ${BigInt(it.book_id)}, ${it.quantity}, ${new Prisma.Decimal(b.retail_price)})`;
    });
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO sale_order_items (order_id, book_id, quantity, unit_price)
      VALUES ${Prisma.join(valuesSql)}
    `);

    // 对账校验: 确认 sale_orders.total_amount == SUM(items.subtotal)
    // 一旦不一致即回滚整个事务, 防止财务流水与明细脱钩.
    const [{ sum }] = await tx.$queryRaw<{ sum: string }[]>`
      SELECT COALESCE(SUM(subtotal), 0)::TEXT AS sum
        FROM sale_order_items WHERE order_id = ${order.id}`;
    if (sum !== total) {
      throw Err.internal(`销售单对账失败: items SUM=${sum} vs total=${total}`);
    }

    return order;
  });

  const detail = await prisma.saleOrder.findUnique({
    where: { id: so.id },
    include: { items: { include: { book: true } } },
  });
  created(res, detail, '销售成功');
});

export default router;

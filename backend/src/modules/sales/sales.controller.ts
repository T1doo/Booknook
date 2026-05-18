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
    // 行级锁: 锁定本次涉及的所有 book 行,防止并发结账时双方都通过库存校验
    // 第二个事务会阻塞在这里,等本事务提交后再读到最新 stock,从而抛准确的"库存不足"
    const locked = await tx.$queryRaw<
      Array<{ id: bigint; title: string; stock: number; retail_price: string }>
    >`SELECT id, title, stock, retail_price
        FROM books
       WHERE id IN (${Prisma.join(bookIds)})
       FOR UPDATE`;
    const map = new Map(locked.map((b) => [b.id.toString(), b]));

    let total = 0;
    for (const it of body.items) {
      const b = map.get(BigInt(it.book_id).toString());
      if (!b) throw Err.badRequest(`书籍 ${it.book_id} 不存在`);
      if (b.stock < it.quantity) {
        throw Err.badRequest(`《${b.title}》库存不足 (当前 ${b.stock}, 需要 ${it.quantity})`);
      }
      total += Number(b.retail_price) * it.quantity;
    }

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

    // 逐项插入: 用 raw SQL,因 subtotal 是 GENERATED STORED 列
    // 触发器自动扣库存并检查预警
    for (const it of body.items) {
      const b = map.get(BigInt(it.book_id).toString())!;
      await tx.$executeRaw`
        INSERT INTO sale_order_items (order_id, book_id, quantity, unit_price)
        VALUES (${order.id}, ${BigInt(it.book_id)}, ${it.quantity}, ${Number(b.retail_price)})`;
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

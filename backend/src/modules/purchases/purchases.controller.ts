/**
 * 进货模块 (PPT 5/6/7/8)
 *  POST /purchases               创建进货单 (pending)
 *  POST /purchases/:id/pay       付款 -> paid + 写支出流水 (DB 触发器)
 *  POST /purchases/:id/return    退货 -> returned (仅 pending 可)
 *  POST /purchases/:id/receive   入库 -> received + 更新 books.stock (DB 触发器)
 *  GET  /purchases               列表
 *  GET  /purchases/:id           详情
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { ok, created, Err } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';

const router = Router();

// ──────────── GET /purchases ────────────────────────────────────────────────
const listQuery = z.object({
  status:   z.enum(['pending', 'paid', 'returned', 'received']).optional(),
  q:        z.string().optional(),  // 在 order_no / supplier 中模糊
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

router.get('/', validate('query', listQuery), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof listQuery>;
  const where: Record<string, unknown> = {};
  if (q.status) where.status = q.status;
  if (q.q) {
    where.OR = [
      { order_no: { contains: q.q, mode: 'insensitive' } },
      { supplier: { contains: q.q, mode: 'insensitive' } },
    ];
  }
  const [total, list] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.findMany({
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

// ──────────── GET /purchases/:id ────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const id = BigInt(req.params.id);
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      items: { include: { book: { select: { id: true, title: true, stock: true, retail_price: true } } } },
      user:  { select: { username: true, real_name: true } },
    },
  });
  if (!po) throw Err.notFound('进货单不存在');
  ok(res, po);
});

// ──────────── POST /purchases ───────────────────────────────────────────────
const itemSchema = z.object({
  book_id:        z.coerce.number().int().positive().optional(), // 已存在书直接引用
  isbn:           z.string().min(10).max(20),
  title:          z.string().min(1).max(200),
  publisher:      z.string().min(1).max(100),
  author:         z.string().min(1).max(100),
  purchase_price: z.coerce.number().nonnegative(),
  quantity:       z.coerce.number().int().positive(),
});

const createSchema = z.object({
  supplier: z.string().max(100).optional(),
  remark:   z.string().max(500).optional(),
  items:    z.array(itemSchema).min(1, '至少一项进货明细'),
});

router.post('/', validate('body', createSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createSchema>;
  // 按"分"为整数累加, 避免 JS Number 浮点累积误差 (B6)
  let totalCents = 0n;
  for (const it of body.items) {
    totalCents += BigInt(Math.round(it.purchase_price * 100)) * BigInt(it.quantity);
  }
  const total = (Number(totalCents) / 100).toFixed(2);

  const po = await prisma.$transaction(async (tx) => {
    // 由 DB 函数生成订单号
    const [{ order_no }] = await tx.$queryRaw<{ order_no: string }[]>`
      SELECT gen_order_no('PO') AS order_no`;

    const order = await tx.purchaseOrder.create({
      data: {
        order_no,
        created_by:   BigInt(req.user!.uid),
        supplier:     body.supplier,
        remark:       body.remark,
        status:       'pending',
        total_amount: total,
      },
    });

    // items 用 raw SQL 插入,因 subtotal 是 GENERATED STORED 列
    for (const it of body.items) {
      await tx.$executeRaw`
        INSERT INTO purchase_order_items
            (order_id, book_id, isbn, title, publisher, author, purchase_price, quantity)
        VALUES
            (${order.id}, ${it.book_id ? BigInt(it.book_id) : null},
             ${it.isbn}, ${it.title}, ${it.publisher}, ${it.author},
             ${it.purchase_price}, ${it.quantity})`;
    }

    return tx.purchaseOrder.findUnique({
      where: { id: order.id },
      include: { items: true },
    });
  });

  created(res, po, '已创建进货单');
});

// ──────────── 状态推进 helpers ──────────────────────────────────────────────
type PoStatus = 'pending' | 'paid' | 'returned' | 'received';

/**
 * 原子地推进进货单状态.
 *  - 使用 updateMany(where:{id, status:{in: from}}) 把"读 + 写"合并到一个 SQL,
 *    DB 层加行锁, 避免并发两个 pay 都先读到 pending 然后双写 paid 触发双流水 (B3).
 *  - count===0 时再判断是"不存在 / 已在目标态(幂等) / 当前状态不允许".
 *  - 触发器会处理副作用 (写流水 / 入库 / 元数据一致性校验).
 */
async function transitStatus(id: bigint, from: PoStatus[], to: 'paid' | 'returned' | 'received') {
  const result = await prisma.purchaseOrder.updateMany({
    where: { id, status: { in: from } },
    data:  { status: to },
  });
  if (result.count === 0) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw Err.notFound('进货单不存在');
    if (po.status === to) return po; // 幂等
    throw Err.badRequest(`当前状态 ${po.status},不允许变更为 ${to}`);
  }
  return prisma.purchaseOrder.findUnique({ where: { id } });
}

router.post('/:id/pay', async (req, res) => {
  const updated = await transitStatus(BigInt(req.params.id), ['pending'], 'paid');
  ok(res, updated, '付款成功');
});

router.post('/:id/return', async (req, res) => {
  const updated = await transitStatus(BigInt(req.params.id), ['pending'], 'returned');
  ok(res, updated, '已退货');
});

const receiveSchema = z.object({
  // 可选: 为某些明细更新零售价(否则使用历史零售价 / 进货价*1.5)
  retail_prices: z.array(z.object({
    item_id:      z.coerce.number().int().positive(),
    retail_price: z.coerce.number().nonnegative(),
  })).optional(),
});

router.post('/:id/receive', validate('body', receiveSchema), async (req, res) => {
  const id = BigInt(req.params.id as string);
  const body = req.body as z.infer<typeof receiveSchema>;
  // 先更新明细价
  if (body.retail_prices?.length) {
    await prisma.$transaction(
      body.retail_prices.map((rp) =>
        prisma.purchaseOrderItem.update({
          where: { id: BigInt(rp.item_id) },
          data:  { retail_price: rp.retail_price },
        }),
      ),
    );
  }
  const updated = await transitStatus(id, ['paid'], 'received');
  ok(res, updated, '入库成功');
});

export default router;

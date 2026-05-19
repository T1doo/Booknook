/**
 * 库存图书管理 (PPT 2-4 + 9)
 *  - 多字段查询: 编号 / ISBN / 书名 / 作者 / 出版社
 *  - 信息修改: 书名 / 作者 / 出版社 / 零售价格 / 预警阈值
 *  - 删除 (软删除策略: 库存为 0 才允许)
 */
import { Router, type Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { ok, created, Err } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';

const router = Router();

// ──────────── GET /books ────────────────────────────────────────────────────
const listQuery = z.object({
  q:        z.string().trim().optional(),
  field:    z.enum(['all', 'id', 'isbn', 'title', 'author', 'publisher']).default('all'),
  category: z.string().optional(),
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort:     z.enum(['id', 'title', 'stock', 'retail_price', 'updated_at']).default('id'),
  order:    z.enum(['asc', 'desc']).default('asc'),
  lowStock: z.coerce.boolean().optional(),
});

router.get('/', validate('query', listQuery), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof listQuery>;

  const where: Record<string, unknown> = {};
  if (q.category) where.category = q.category;
  if (q.lowStock) where.stock = { lte: prisma.book.fields.low_stock_threshold };
  if (q.q) {
    const kw = q.q;
    switch (q.field) {
      case 'id':
        if (!/^\d+$/.test(kw)) throw Err.badRequest('编号必须为数字');
        where.id = BigInt(kw);
        break;
      case 'isbn':
        where.isbn = { equals: kw };
        break;
      case 'title':
        where.title = { contains: kw, mode: 'insensitive' };
        break;
      case 'author':
        where.author = { contains: kw, mode: 'insensitive' };
        break;
      case 'publisher':
        where.publisher = { contains: kw, mode: 'insensitive' };
        break;
      default: {
        // D3: 'all' 模式如果关键词是纯数字, 也尝试按 ID 匹配
        const ors: Record<string, unknown>[] = [
          { isbn:      { equals: kw } },
          { title:     { contains: kw, mode: 'insensitive' } },
          { author:    { contains: kw, mode: 'insensitive' } },
          { publisher: { contains: kw, mode: 'insensitive' } },
        ];
        if (/^\d+$/.test(kw)) ors.push({ id: BigInt(kw) });
        where.OR = ors;
      }
    }
  }

  const [total, list] = await Promise.all([
    prisma.book.count({ where }),
    prisma.book.findMany({
      where,
      orderBy: { [q.sort]: q.order },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  ok(res, { total, page: q.page, pageSize: q.pageSize, list });
});

// ──────────── GET /books/categories ─────────────────────────────────────────
router.get('/categories', async (_req, res) => {
  const rows = await prisma.book.groupBy({
    by: ['category'],
    _count: { _all: true },
    _sum: { stock: true },
  });
  ok(res, rows.map((r) => ({
    category: r.category ?? '未分类',
    count: r._count._all,
    stock: r._sum.stock ?? 0,
  })));
});

// ──────────── GET /books/:id ────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const id = BigInt(req.params.id);
  const book = await prisma.book.findUnique({ where: { id } });
  if (!book) throw Err.notFound('书籍不存在');
  ok(res, book);
});

// ──────────── PATCH /books/:id ──────────────────────────────────────────────
// F7: 加 ISBN 格式校验和 retail_price 上限, 防止误输入或恶意值
const updateSchema = z.object({
  title:               z.string().min(1).max(200).optional(),
  author:              z.string().min(1).max(100).optional(),
  publisher:           z.string().min(1).max(100).optional(),
  retail_price:        z.coerce.number().nonnegative().max(99999.99).optional(),
  low_stock_threshold: z.coerce.number().int().nonnegative().max(10000).optional(),
  cover_url:           z.string().url().optional().or(z.literal('')),
  category:            z.string().max(50).optional(),
});

router.patch('/:id', validate('body', updateSchema), async (req, res) => {
  const id = BigInt(req.params.id as string);
  const book = await prisma.book.findUnique({ where: { id } });
  if (!book) throw Err.notFound('书籍不存在');

  // C14: 把改动前的关键字段快照塞进 req, 由 audit 中间件合并写入 operation_logs.payload.
  //      重点关注零售价/作者/书名/出版社等业务关键字段, 留下完整变更前后留痕.
  (req as Request & { auditBefore?: Record<string, unknown> }).auditBefore = {
    title:        book.title,
    author:       book.author,
    publisher:    book.publisher,
    retail_price: book.retail_price.toString(),
    category:     book.category,
  };

  const updated = await prisma.book.update({
    where: { id },
    data: req.body as z.infer<typeof updateSchema>,
  });
  ok(res, updated, '已更新');
});

// ──────────── DELETE /books/:id ─────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const id = BigInt(req.params.id);
  const book = await prisma.book.findUnique({ where: { id } });
  if (!book) throw Err.notFound();
  if (book.stock > 0) throw Err.badRequest('库存不为 0,不能删除');
  // 检查是否被引用
  const refSale = await prisma.saleOrderItem.count({ where: { book_id: id } });
  if (refSale > 0) throw Err.badRequest('该书存在销售记录,不能删除');
  await prisma.book.delete({ where: { id } });
  ok(res, null, '已删除');
});

// ──────────── POST /books (直接新增已有库存书籍,补充用) ────────────────────
// F7: ISBN 用 10/13 位数字校验, retail_price/threshold 加上限
const createSchema = z.object({
  isbn:                z.string().regex(/^\d{10}(\d{3})?$/, 'ISBN 应为 10 或 13 位数字'),
  title:               z.string().min(1).max(200),
  author:              z.string().min(1).max(100),
  publisher:           z.string().min(1).max(100),
  retail_price:        z.coerce.number().nonnegative().max(99999.99),
  stock:               z.coerce.number().int().nonnegative().max(1_000_000).default(0),
  low_stock_threshold: z.coerce.number().int().nonnegative().max(10000).default(5),
  category:            z.string().max(50).optional(),
  cover_url:           z.string().url().optional(),
});

router.post('/', validate('body', createSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createSchema>;
  const dup = await prisma.book.findUnique({ where: { isbn: body.isbn } });
  if (dup) throw Err.conflict('ISBN 已存在');
  const book = await prisma.book.create({ data: body });
  created(res, book, '已新增');
});

export default router;

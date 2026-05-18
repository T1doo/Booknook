/**
 * 数据可视化 Dashboard 加分项
 *  GET /analytics/dashboard      四张 KPI + 库存预警快照
 *  GET /analytics/sales-trend    近 30 天销售趋势
 *  GET /analytics/top-books      Top 10 畅销
 *  GET /analytics/finance-monthly 月度收支
 *  GET /analytics/category       库存按分类
 */
import { Router } from 'express';
import { prisma } from '../../config/db.js';
import { ok } from '../../utils/http.js';

const router = Router();

// 暖书阁面向中国用户,统一使用 Asia/Shanghai (UTC+8) 计算"今天 / 本月起点",
// 否则若部署在 UTC 服务器上,北京时间 0-8 点的销售会被归到"昨天"导致 KPI 偏移。
const CN_OFFSET_MS = 8 * 60 * 60 * 1000;
function cnDayStart(): Date {
  const nowCN = new Date(Date.now() + CN_OFFSET_MS);
  return new Date(
    Date.UTC(nowCN.getUTCFullYear(), nowCN.getUTCMonth(), nowCN.getUTCDate()) - CN_OFFSET_MS,
  );
}
function cnMonthStart(): Date {
  const nowCN = new Date(Date.now() + CN_OFFSET_MS);
  return new Date(
    Date.UTC(nowCN.getUTCFullYear(), nowCN.getUTCMonth(), 1) - CN_OFFSET_MS,
  );
}

router.get('/dashboard', async (_req, res) => {
  const todayStart = cnDayStart();
  const monthStart = cnMonthStart();

  const [todaySales, monthSales, totalStock, pendingPo, alertsCount, booksCount] = await Promise.all([
    prisma.saleOrder.aggregate({
      where: { created_at: { gte: todayStart } },
      _sum: { total_amount: true }, _count: { _all: true },
    }),
    prisma.saleOrder.aggregate({
      where: { created_at: { gte: monthStart } },
      _sum: { total_amount: true }, _count: { _all: true },
    }),
    prisma.book.aggregate({ _sum: { stock: true } }),
    prisma.purchaseOrder.aggregate({
      where: { status: 'pending' },
      _sum: { total_amount: true }, _count: { _all: true },
    }),
    prisma.inventoryAlert.count({ where: { resolved: false } }),
    prisma.book.count(),
  ]);

  ok(res, {
    today: {
      sales:  Number(todaySales._sum.total_amount ?? 0),
      orders: todaySales._count._all,
    },
    month: {
      sales:  Number(monthSales._sum.total_amount ?? 0),
      orders: monthSales._count._all,
    },
    stock: {
      totalStock: totalStock._sum.stock ?? 0,
      titles:     booksCount,
    },
    pendingPurchase: {
      amount: Number(pendingPo._sum.total_amount ?? 0),
      count:  pendingPo._count._all,
    },
    alertsCount,
  });
});

router.get('/sales-trend', async (_req, res) => {
  const rows = await prisma.$queryRawUnsafe<Array<{ day: Date; order_count: bigint; book_count: bigint; total_amount: string }>>(
    `SELECT day, order_count, book_count, total_amount FROM v_daily_sales_trend ORDER BY day`,
  );
  ok(res, rows.map((r) => ({
    day:          r.day.toISOString().slice(0, 10),
    order_count:  Number(r.order_count),
    book_count:   Number(r.book_count),
    total_amount: Number(r.total_amount),
  })));
});

router.get('/top-books', async (_req, res) => {
  const rows = await prisma.$queryRawUnsafe<Array<{
    book_id: bigint; title: string; author: string; sold_qty: number; sold_amount: string;
  }>>(
    `SELECT book_id, title, author, sold_qty, sold_amount
       FROM v_book_sales_summary
      WHERE sold_qty > 0
      ORDER BY sold_qty DESC, sold_amount DESC
      LIMIT 10`,
  );
  ok(res, rows.map((r) => ({
    book_id:     r.book_id.toString(),
    title:       r.title,
    author:      r.author,
    sold_qty:    r.sold_qty,
    sold_amount: Number(r.sold_amount),
  })));
});

router.get('/finance-monthly', async (_req, res) => {
  const rows = await prisma.$queryRawUnsafe<Array<{
    month: string; income: string; expense: string; net: string; tx_count: bigint;
  }>>(`SELECT * FROM v_monthly_finance ORDER BY month`);
  ok(res, rows.map((r) => ({
    month:   r.month,
    income:  Number(r.income),
    expense: Number(r.expense),
    net:     Number(r.net),
    count:   Number(r.tx_count),
  })));
});

router.get('/category', async (_req, res) => {
  const rows = await prisma.book.groupBy({
    by: ['category'],
    _count: { _all: true },
    _sum:   { stock: true },
  });
  ok(res, rows.map((r) => ({
    category: r.category ?? '未分类',
    titles:   r._count._all,
    stock:    r._sum.stock ?? 0,
  })));
});

export default router;

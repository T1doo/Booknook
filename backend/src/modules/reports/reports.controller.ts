/**
 * 报表导出 (加分项)
 *   GET /reports/sales.xlsx?from=&to=
 *   GET /reports/purchases.xlsx?status=
 *   GET /reports/finance.xlsx?from=&to=
 *   GET /reports/finance.pdf?from=&to=  -- 月度财务 PDF
 */
import { Router } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { logger } from '../../config/logger.js';
import { validate } from '../../middlewares/validate.js';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR  = path.resolve(__dirname, '../../../assets/fonts');

function parseDate(str: string | undefined): Date | undefined {
  return str ? new Date(str) : undefined;
}

// C8: 所有报表 query 参数走 zod 校验, 防止注入 Prisma 不认识的 status 导致 500.
const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to:   z.string().datetime().optional(),
});
const purchaseExportSchema = z.object({
  status: z.enum(['pending', 'paid', 'returned', 'received']).optional(),
});

// ─────────── /reports/sales.xlsx ────────────────────────────────────────────
router.get('/sales.xlsx', validate('query', dateRangeSchema), async (req, res) => {
  const from = parseDate(req.query.from as string | undefined);
  const to   = parseDate(req.query.to   as string | undefined);

  const orders = await prisma.saleOrder.findMany({
    where: {
      ...(from || to
        ? { created_at: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    },
    orderBy: { created_at: 'desc' },
    include: {
      user: true,
      items: { include: { book: true } },
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'BookNook';
  wb.created = new Date();

  const ws = wb.addWorksheet('销售明细');
  ws.columns = [
    { header: '销售单号', key: 'order_no', width: 22 },
    { header: '销售时间', key: 'created_at', width: 22 },
    { header: '操作员',   key: 'operator', width: 12 },
    { header: '书名',     key: 'title', width: 30 },
    { header: 'ISBN',     key: 'isbn',  width: 16 },
    { header: '作者',     key: 'author', width: 16 },
    { header: '数量',     key: 'quantity', width: 8 },
    { header: '单价',     key: 'unit_price', width: 10 },
    { header: '小计',     key: 'subtotal', width: 12 },
    { header: '客户备注', key: 'note', width: 20 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' },
  };

  for (const o of orders) {
    for (const it of o.items) {
      ws.addRow({
        order_no:   o.order_no,
        created_at: o.created_at.toISOString().replace('T', ' ').slice(0, 19),
        operator:   o.user?.real_name ?? '-',
        title:      it.book?.title ?? '-',
        isbn:       it.book?.isbn ?? '-',
        author:     it.book?.author ?? '-',
        quantity:   it.quantity,
        unit_price: Number(it.unit_price),
        subtotal:   Number(it.subtotal),
        note:       o.customer_note ?? '',
      });
    }
  }

  // 汇总
  ws.addRow({});
  const total = orders.reduce((s, o) => s + Number(o.total_amount), 0);
  const sumRow = ws.addRow({ order_no: '合计', subtotal: total });
  sumRow.font = { bold: true };

  res.setHeader('Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition',
    `attachment; filename="sales-${new Date().toISOString().slice(0,10)}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// ─────────── /reports/purchases.xlsx ────────────────────────────────────────
router.get('/purchases.xlsx', validate('query', purchaseExportSchema), async (req, res) => {
  const { status } = req.query as unknown as z.infer<typeof purchaseExportSchema>;
  const orders = await prisma.purchaseOrder.findMany({
    where: status ? { status } : {},
    orderBy: { created_at: 'desc' },
    include: { user: true, items: true },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('进货明细');
  ws.columns = [
    { header: '进货单号', key: 'order_no', width: 22 },
    { header: '状态',     key: 'status', width: 10 },
    { header: '供应商',   key: 'supplier', width: 24 },
    { header: '创建时间', key: 'created_at', width: 22 },
    { header: '书名',     key: 'title', width: 30 },
    { header: 'ISBN',     key: 'isbn',  width: 16 },
    { header: '进货价',   key: 'purchase_price', width: 10 },
    { header: '数量',     key: 'quantity', width: 8 },
    { header: '小计',     key: 'subtotal', width: 12 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' },
  };

  for (const o of orders) {
    for (const it of o.items) {
      ws.addRow({
        order_no: o.order_no,
        status: o.status,
        supplier: o.supplier ?? '-',
        created_at: o.created_at.toISOString().replace('T', ' ').slice(0, 19),
        title: it.title, isbn: it.isbn,
        purchase_price: Number(it.purchase_price),
        quantity: it.quantity,
        subtotal: Number(it.subtotal),
      });
    }
  }

  res.setHeader('Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition',
    `attachment; filename="purchases-${new Date().toISOString().slice(0,10)}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// ─────────── /reports/finance.xlsx ──────────────────────────────────────────
router.get('/finance.xlsx', validate('query', dateRangeSchema), async (req, res) => {
  const from = parseDate(req.query.from as string | undefined);
  const to   = parseDate(req.query.to   as string | undefined);
  const rows = await prisma.transaction.findMany({
    where: {
      ...(from || to
        ? { created_at: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    },
    orderBy: { created_at: 'desc' },
    include: { user: true },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('财务流水');
  ws.columns = [
    { header: '时间', key: 'created_at', width: 22 },
    { header: '类型', key: 'type', width: 8 },
    { header: '金额', key: 'amount', width: 12 },
    { header: '描述', key: 'description', width: 36 },
    { header: '操作员', key: 'operator', width: 12 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' },
  };

  let income = 0, expense = 0;
  for (const r of rows) {
    const amt = Number(r.amount);
    if (r.type === 'income') income += amt; else expense += amt;
    ws.addRow({
      created_at:  r.created_at.toISOString().replace('T', ' ').slice(0, 19),
      type:        r.type === 'income' ? '收入' : '支出',
      amount:      amt,
      description: r.description,
      operator:    r.user?.real_name ?? '-',
    });
  }
  ws.addRow({});
  ws.addRow({ created_at: '收入合计', amount: income }).font = { bold: true };
  ws.addRow({ created_at: '支出合计', amount: expense }).font = { bold: true };
  ws.addRow({ created_at: '净收益',   amount: income - expense }).font = { bold: true };

  res.setHeader('Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition',
    `attachment; filename="finance-${new Date().toISOString().slice(0,10)}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// ─────────── /reports/finance.pdf  月度财务 PDF (含汇总) ───────────────────
router.get('/finance.pdf', validate('query', dateRangeSchema), async (req, res) => {
  const from = parseDate(req.query.from as string | undefined);
  const to   = parseDate(req.query.to   as string | undefined);

  const rows = await prisma.transaction.findMany({
    where: {
      ...(from || to
        ? { created_at: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    },
    orderBy: { created_at: 'desc' },
    include: { user: true },
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `attachment; filename="finance-${new Date().toISOString().slice(0,10)}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
  doc.pipe(res);

  // 中文字体: 按优先级扫描多个候选路径, 找到第一个就用.
  // 项目自带字体优先, 没有则 fallback 到系统自带的常见中文 TTF.
  // 全部找不到才警告并使用 PDFKit 默认字体 Helvetica (中文显示为乱码).
  const fontCandidates = [
    path.join(FONT_DIR, 'NotoSerifSC-Regular.ttf'),  // 项目自带 (跨平台最稳, 可选 commit)
    'C:\\Windows\\Fonts\\simhei.ttf',                 // Windows 黑体
    'C:\\Windows\\Fonts\\simkai.ttf',                 // Windows 楷体
    'C:\\Windows\\Fonts\\simfang.ttf',                // Windows 仿宋
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttf',   // Linux 文泉驿黑体
    '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttf', // Linux Noto Serif CJK
  ];
  const fontPath = fontCandidates.find((p) => fs.existsSync(p));
  if (fontPath) {
    doc.font(fontPath);
  } else {
    logger.warn('找不到任何中文字体, PDF 中文会乱码. 请放 NotoSerifSC-Regular.ttf 到 backend/assets/fonts/');
  }

  // ============================================================
  //  精美 PDF 排版: 暖书店主题 + 卡片汇总 + 表格明细
  //  注: 金额用全角 ￥ (U+FFE5), 中文字体兼容性比半角 ¥ (U+00A5) 好
  // ============================================================
  const C = {
    accent:  '#b45309',  // 琥珀 (主品牌色)
    brown:   '#78350f',  // 深棕 (标题)
    income:  '#16a34a',  // 收入绿
    expense: '#dc2626',  // 支出红
    text:    '#111827',  // 主文字
    muted:   '#6b7280',  // 次文字
    border:  '#e5e7eb',  // 边框
    cardBg:  '#fafaf9',  // 卡片底
    zebra:   '#f5f5f4',  // 斑马纹
  };
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const M = 50;
  const W = PAGE_W - M * 2;

  // 汇总
  let income = 0, expense = 0, incomeCount = 0, expenseCount = 0;
  for (const r of rows) {
    const amt = Number(r.amount);
    if (r.type === 'income') { income += amt; incomeCount++; }
    else                     { expense += amt; expenseCount++; }
  }
  const net = income - expense;

  // ─── ① 标题区 ─────────────────────────────────────────────
  doc.fillColor(C.brown).fontSize(24)
     .text('BookNook · 财务报表', M, 50, { width: W, align: 'center' });
  // 琥珀色分隔线
  doc.moveTo(M, 92).lineTo(M + W, 92)
     .strokeColor(C.accent).lineWidth(1.5).stroke();
  // 元信息
  doc.fillColor(C.muted).fontSize(10)
     .text(`导出时间: ${new Date().toLocaleString('zh-CN')}`,
           M, 100, { width: W, align: 'center' });
  let headerBottom = 117;
  if (from || to) {
    const range = `${from ? from.toISOString().slice(0, 10) : '不限'}  ~  ${to ? to.toISOString().slice(0, 10) : '不限'}`;
    doc.text(`统计期间: ${range}`, M, 117, { width: W, align: 'center' });
    headerBottom = 134;
  }

  // ─── ② 三张汇总卡片 ─────────────────────────────────────
  const cardY = headerBottom + 15;
  const cardH = 80;
  const cardW = (W - 20) / 3;
  const cards = [
    { label: '收入合计', amount: income,  count: incomeCount,  color: C.income },
    { label: '支出合计', amount: expense, count: expenseCount, color: C.expense },
    { label: '净收益',   amount: net,     count: rows.length,  color: net >= 0 ? C.income : C.expense },
  ];
  cards.forEach((c, i) => {
    const x = M + i * (cardW + 10);
    // 卡片底色
    doc.roundedRect(x, cardY, cardW, cardH, 6).fillColor(C.cardBg).fill();
    // 卡片描边
    doc.roundedRect(x, cardY, cardW, cardH, 6).strokeColor(C.border).lineWidth(0.6).stroke();
    // 顶部 4px 色条 (强调卡片颜色)
    doc.rect(x, cardY, cardW, 4).fillColor(c.color).fill();
    // 标签
    doc.fillColor(C.muted).fontSize(10)
       .text(c.label, x + 14, cardY + 16, { width: cardW - 28 });
    // 金额
    doc.fillColor(c.color).fontSize(22)
       .text(`￥ ${c.amount.toFixed(2)}`, x + 14, cardY + 34, { width: cardW - 28 });
    // 笔数
    doc.fillColor(C.muted).fontSize(9)
       .text(`${c.count} 笔交易`, x + 14, cardY + 62, { width: cardW - 28 });
  });

  // ─── ③ 明细表 ───────────────────────────────────────────
  const tableTitleY = cardY + cardH + 28;
  doc.fillColor(C.brown).fontSize(13)
     .text(`流水明细  (共 ${rows.length} 条)`, M, tableTitleY);
  doc.moveTo(M, tableTitleY + 20).lineTo(M + W, tableTitleY + 20)
     .strokeColor(C.accent).lineWidth(1).stroke();

  // 表头
  const headerY = tableTitleY + 28;
  const cols: { name: string; x: number; w: number; align?: 'left' | 'right' | 'center' }[] = [
    { name: '时间',     x: M,         w: 100 },
    { name: '类型',     x: M + 100,   w: 40, align: 'center' },
    { name: '金额 (元)', x: M + 140,   w: 75, align: 'right' },
    { name: '说明',     x: M + 225,   w: 213 },
    { name: '操作员',   x: M + 438,   w: 57 },
  ];
  // 表头背景色条 (淡米色)
  doc.rect(M, headerY - 4, W, 20).fillColor('#fef3c7').fill();
  doc.fillColor(C.brown).fontSize(9.5);
  cols.forEach((col) => {
    doc.text(col.name, col.x + 4, headerY, { width: col.w - 4, align: col.align ?? 'left' });
  });
  doc.moveTo(M, headerY + 16).lineTo(M + W, headerY + 16)
     .strokeColor(C.accent).lineWidth(0.8).stroke();

  // 明细行 (限 35 条, 防溢出单页; 超过提示用 XLSX)
  const MAX_ROWS = 35;
  const ROW_H = 17;
  const startRowY = headerY + 22;
  const displayed = rows.slice(0, MAX_ROWS);

  displayed.forEach((r, i) => {
    const y = startRowY + i * ROW_H;
    // 斑马纹 (偶数行底色)
    if (i % 2 === 1) {
      doc.rect(M, y - 3, W, ROW_H).fillColor(C.zebra).fill();
    }
    const time = r.created_at.toISOString().slice(0, 16).replace('T', ' ');
    const type = r.type === 'income' ? '收入' : '支出';
    const amt  = `￥ ${Number(r.amount).toFixed(2)}`;
    const typeColor = r.type === 'income' ? C.income : C.expense;

    doc.fillColor(C.muted).fontSize(8.5)
       .text(time, cols[0].x + 4, y, { width: cols[0].w - 4 });
    doc.fillColor(typeColor).fontSize(8.5)
       .text(type, cols[1].x, y, { width: cols[1].w, align: 'center' });
    doc.fillColor(typeColor).fontSize(9)
       .text(amt, cols[2].x, y, { width: cols[2].w - 4, align: 'right' });
    doc.fillColor(C.text).fontSize(8.5)
       .text(r.description, cols[3].x + 4, y, { width: cols[3].w - 4, ellipsis: true });
    doc.fillColor(C.muted).fontSize(8.5)
       .text(r.user?.real_name ?? '-', cols[4].x, y, { width: cols[4].w });
  });

  // 表底分隔线
  const tableBottom = startRowY + displayed.length * ROW_H + 4;
  doc.moveTo(M, tableBottom).lineTo(M + W, tableBottom)
     .strokeColor(C.border).lineWidth(0.5).stroke();

  // 超出提示
  if (rows.length > MAX_ROWS) {
    doc.fillColor(C.muted).fontSize(9)
       .text(`...仅显示前 ${MAX_ROWS} 条, 共 ${rows.length} 条. 完整明细请使用 XLSX 导出.`,
             M, tableBottom + 10, { width: W, align: 'center' });
  }

  // ─── ④ 页脚 ─────────────────────────────────────────────
  doc.fillColor(C.muted).fontSize(8)
     .text('BookNook 暖书阁 · 数据库引论 中期实验 2026',
           M, PAGE_H - 38, { width: W, align: 'center' });
  doc.fillColor('#c7b89a').fontSize(7)
     .text('本报表由系统自动生成 · 仅供内部审计使用',
           M, PAGE_H - 24, { width: W, align: 'center' });

  doc.end();
});

export default router;

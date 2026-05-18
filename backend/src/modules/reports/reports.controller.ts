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
import { prisma } from '../../config/db.js';
import { logger } from '../../config/logger.js';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR  = path.resolve(__dirname, '../../../assets/fonts');

function parseDate(str: string | undefined): Date | undefined {
  return str ? new Date(str) : undefined;
}

// ─────────── /reports/sales.xlsx ────────────────────────────────────────────
router.get('/sales.xlsx', async (req, res) => {
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
router.get('/purchases.xlsx', async (req, res) => {
  const status = req.query.status as string | undefined;
  const orders = await prisma.purchaseOrder.findMany({
    where: status ? { status: status as 'pending' } : {},
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
router.get('/finance.xlsx', async (req, res) => {
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
router.get('/finance.pdf', async (req, res) => {
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

  // 中文字体: 尝试加载内置 Noto Serif SC,失败则使用默认 (英文 + 数字仍可正常呈现)
  const fontPath = path.join(FONT_DIR, 'NotoSerifSC-Regular.ttf');
  if (fs.existsSync(fontPath)) {
    doc.font(fontPath);
  } else {
    logger.warn('中文字体缺失,PDF 中的中文可能为方框');
  }

  doc.fontSize(20).text('BookNook · 财务报表', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#666').text(
    `导出时间: ${new Date().toLocaleString('zh-CN')}`, { align: 'center' });
  doc.moveDown(1);

  let income = 0, expense = 0;
  for (const r of rows) {
    const amt = Number(r.amount);
    if (r.type === 'income') income += amt; else expense += amt;
  }

  doc.fillColor('#000').fontSize(12);
  doc.text(`收入合计: ¥ ${income.toFixed(2)}`);
  doc.text(`支出合计: ¥ ${expense.toFixed(2)}`);
  doc.fillColor(income - expense >= 0 ? '#16a34a' : '#dc2626')
     .text(`净收益:   ¥ ${(income - expense).toFixed(2)}`);
  doc.moveDown();
  doc.fillColor('#000');

  // 列表
  doc.fontSize(11).text('明细:', { underline: true });
  doc.moveDown(0.5);

  rows.slice(0, 200).forEach((r) => {
    const amt = Number(r.amount);
    const line = `${r.created_at.toISOString().slice(0,16).replace('T',' ')}  `
               + `[${r.type === 'income' ? '收' : '支'}] `
               + `¥${amt.toFixed(2).padStart(10)}  `
               + `${r.description}  (${r.user?.real_name ?? '-'})`;
    doc.fontSize(9).text(line);
  });
  if (rows.length > 200) {
    doc.moveDown().fontSize(9).fillColor('#666')
       .text(`...仅显示前 200 条,共 ${rows.length} 条`);
  }

  doc.end();
});

export default router;

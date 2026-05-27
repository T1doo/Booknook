'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Plus, ShoppingBag, CreditCard, Undo2, Package, Eye, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/layout/page-header';
import { Pagination } from '@/components/layout/pagination';
import { EmptyState } from '@/components/empty-state';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useT } from '@/i18n';

type PoStatus = 'pending' | 'paid' | 'returned' | 'received';
type PoItem = {
  id: string; book_id: string | null; isbn: string; title: string; publisher: string; author: string;
  purchase_price: string | number; quantity: number; retail_price: string | number | null;
  subtotal: string | number;
  book?: { id: string; title: string; stock: number; retail_price: string | number } | null;
};
type Po = {
  id: string; order_no: string; supplier: string | null;
  status: PoStatus; total_amount: string | number;
  created_at: string;
  paid_at: string | null;
  returned_at: string | null;
  received_at: string | null;
  user?: { username: string; real_name: string };
  _count?: { items: number };
};
type ListResp = { total: number; page: number; pageSize: number; list: Po[] };

const PAGE_SIZE = 10;

const STATUS_META: Record<PoStatus, { label: string; variant: 'muted' | 'success' | 'warning' | 'destructive' }> = {
  pending:  { label: '未付款', variant: 'warning' },
  paid:     { label: '已付款', variant: 'muted' },
  returned: { label: '已退货', variant: 'destructive' },
  received: { label: '已入库', variant: 'success' },
};

export default function PurchasesPage() {
  const t = useT();
  const [tab, setTab] = useState<'all' | PoStatus>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [receivingId, setReceivingId] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const qs = `?page=${page}&pageSize=${PAGE_SIZE}` + (tab !== 'all' ? `&status=${tab}` : '');
      const r = await api.get<ListResp>(`/purchases${qs}`);
      setData(r);
    } finally {
      setLoading(false);
    }
  }, [page, tab]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const doAction = async (id: string, action: 'pay' | 'return' | 'receive') => {
    try {
      const confirmKey = { pay: 'purchase.confirm_pay', return: 'purchase.confirm_return', receive: 'purchase.confirm_receive' }[action];
      const successKey = { pay: 'purchase.pay_success', return: 'purchase.return_success', receive: 'purchase.receive_success' }[action];
      if (!confirm(t(confirmKey))) return;
      await api.post(`/purchases/${id}/${action}`);
      toast.success(t(successKey));
      fetchList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('purchase.action_failed'));
    }
  };

  return (
    <div>
      <PageHeader
        title={t('purchase.title_page')}
        description={t('purchase.desc_page')}
        action={
          <Button onClick={() => setOpenCreate(true)}>
            <Plus className="size-4" />{t('purchase.new_button')}
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); setPage(1); }} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">{t('purchase.tabs_all')}</TabsTrigger>
          <TabsTrigger value="pending">{t('purchase.status.pending')}</TabsTrigger>
          <TabsTrigger value="paid">{t('purchase.status.paid')}</TabsTrigger>
          <TabsTrigger value="received">{t('purchase.status.received')}</TabsTrigger>
          <TabsTrigger value="returned">{t('purchase.status.returned')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading && !data ? (
        <Skeleton className="h-64" />
      ) : !data || data.total === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={t('purchase.empty')}
          action={<Button onClick={() => setOpenCreate(true)}><Plus className="size-4" />{t('purchase.new_button')}</Button>}
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44 font-mono">{t('purchase.order_no')}</TableHead>
                <TableHead>{t('purchase.supplier_th')}</TableHead>
                <TableHead className="w-24">{t('purchase.items_count')}</TableHead>
                <TableHead className="w-28 text-right">{t('purchase.amount_label')}</TableHead>
                <TableHead className="w-24">{t('user.status')}</TableHead>
                <TableHead className="w-32">{t('common.time')}</TableHead>
                <TableHead className="w-24">{t('common.operator')}</TableHead>
                <TableHead className="w-64 text-right">{t('common.operations')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.list.map((p) => {
                const meta = STATUS_META[p.status];
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.order_no}</TableCell>
                    <TableCell>{p.supplier ?? <span className="text-muted-foreground/50">—</span>}</TableCell>
                    <TableCell>{p._count?.items ?? 0} {t('purchase.items_suffix')}</TableCell>
                    <TableCell className="text-right tabular">{formatCurrency(p.total_amount)}</TableCell>
                    <TableCell><Badge variant={meta.variant}>{t(`purchase.status.${p.status}`)}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(p.created_at)}</TableCell>
                    <TableCell className="text-xs">{p.user?.real_name ?? '-'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewing(p.id)} aria-label={t('purchase.view')}>
                        <Eye className="size-4" />
                      </Button>
                      {p.status === 'pending' && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => doAction(p.id, 'pay')}>
                            <CreditCard className="size-3.5" />{t('purchase.pay')}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => doAction(p.id, 'return')}>
                            <Undo2 className="size-3.5" />{t('purchase.return_')}
                          </Button>
                        </>
                      )}
                      {p.status === 'paid' && (
                        <Button variant="accent" size="sm" onClick={() => setReceivingId(p.id)}>
                          <Package className="size-3.5" />{t('purchase.receive')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
        </>
      )}

      <CreatePurchaseDialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreated={() => { setOpenCreate(false); fetchList(); }}
      />

      <ViewPurchaseDialog id={viewing} onClose={() => setViewing(null)} />

      <ReceiveDialog
        id={receivingId}
        onClose={() => setReceivingId(null)}
        onReceived={() => { setReceivingId(null); fetchList(); }}
      />
    </div>
  );
}

// ─── 新建进货单 ────────────────────────────────────────────────────────
type CartLine = {
  book_id?: string;        // 已有书
  isbn: string;
  title: string;
  publisher: string;
  author: string;
  purchase_price: string;
  quantity: string;
};

function blankLine(): CartLine {
  return { isbn: '', title: '', publisher: '', author: '', purchase_price: '', quantity: '1' };
}

function CreatePurchaseDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [supplier, setSupplier] = useState('');
  const [remark, setRemark]     = useState('');
  const [lines, setLines]       = useState<CartLine[]>([blankLine()]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSupplier(''); setRemark(''); setLines([blankLine()]);
    }
  }, [open]);

  const total = lines.reduce((s, l) =>
    s + (Number(l.purchase_price) || 0) * (Number(l.quantity) || 0), 0);

  const updateLine = (idx: number, patch: Partial<CartLine>) => {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
  };

  // 根据 ISBN 查询是否已有库存
  const handleIsbnBlur = async (idx: number) => {
    const line = lines[idx];
    if (!line.isbn || line.title) return;
    try {
      const r = await api.get<{ list: { id: string; isbn: string; title: string; publisher: string; author: string }[] }>
        (`/books?q=${encodeURIComponent(line.isbn)}&field=isbn`);
      const exist = r.list[0];
      if (exist) {
        updateLine(idx, {
          book_id: exist.id, title: exist.title,
          publisher: exist.publisher, author: exist.author,
        });
        toast.success(`已自动填充: ${exist.title}`);
      }
    } catch { /* ignore */ }
  };

  const handleSubmit = async () => {
    const valid = lines.every((l) => l.isbn && l.title && l.publisher && l.author && Number(l.purchase_price) > 0 && Number(l.quantity) > 0);
    if (!valid) { toast.error('请完整填写每行明细'); return; }

    // D8: 提交前再做一次 isbn 与 book_id 的一致性校验.
    // 场景: 用户输入 ISBN-A 触发 blur 自动填充, 拿到 book_id=A;
    //       接着把 ISBN 改成 B 但不离开焦点直接点提交, 此时 book_id 仍指向 A → 数据错乱.
    // updateLine 在 onChange 里已会清空 book_id, 但额外做一次防御不会出错.
    // 这里直接清掉所有 book_id 不一致的引用.
    const fetchedIsbnMap = new Map<string, string>(); // book_id -> 已知正确的 isbn
    const cleanedLines = lines.map((l) => {
      if (l.book_id) {
        const known = fetchedIsbnMap.get(l.book_id);
        if (known && known !== l.isbn) {
          return { ...l, book_id: undefined };
        }
        if (!known) fetchedIsbnMap.set(l.book_id, l.isbn);
      }
      return l;
    });

    setSubmitting(true);
    try {
      await api.post('/purchases', {
        supplier: supplier || undefined,
        remark:   remark   || undefined,
        items: cleanedLines.map((l) => ({
          book_id:        l.book_id ? Number(l.book_id) : undefined,
          isbn:           l.isbn,
          title:          l.title,
          publisher:      l.publisher,
          author:         l.author,
          purchase_price: Number(l.purchase_price),
          quantity:       Number(l.quantity),
        })),
      });
      toast.success('进货单已创建');
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>新建进货单</DialogTitle>
          <DialogDescription>
            ISBN 已存在的书会自动填充信息;新书填完整后,入库时会自动进入库存
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="po-supplier">供应商</Label>
            <Input id="po-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="po-remark">备注</Label>
            <Input id="po-remark" value={remark} onChange={(e) => setRemark(e.target.value)} />
          </div>
        </div>

        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-2 w-44">ISBN</th>
                <th className="text-left p-2">书名</th>
                <th className="text-left p-2 w-28">作者</th>
                <th className="text-left p-2 w-32">出版社</th>
                <th className="text-right p-2 w-24">进货价</th>
                <th className="text-right p-2 w-20">数量</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-t">
                  <td className="p-1.5"><Input className="h-8 font-mono text-xs" value={l.isbn}
                                                onChange={(e) => updateLine(i, { isbn: e.target.value, book_id: undefined })}
                                                onBlur={() => handleIsbnBlur(i)} /></td>
                  <td className="p-1.5"><Input className="h-8" value={l.title} onChange={(e) => updateLine(i, { title: e.target.value })} /></td>
                  <td className="p-1.5"><Input className="h-8" value={l.author} onChange={(e) => updateLine(i, { author: e.target.value })} /></td>
                  <td className="p-1.5"><Input className="h-8" value={l.publisher} onChange={(e) => updateLine(i, { publisher: e.target.value })} /></td>
                  <td className="p-1.5"><Input className="h-8 text-right tabular" type="number" min="0" step="0.01"
                                                value={l.purchase_price}
                                                onChange={(e) => updateLine(i, { purchase_price: e.target.value })} /></td>
                  <td className="p-1.5"><Input className="h-8 text-right tabular" type="number" min="1"
                                                value={l.quantity}
                                                onChange={(e) => updateLine(i, { quantity: e.target.value })} /></td>
                  <td className="p-1.5 text-center">
                    <Button variant="ghost" size="icon"
                            onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                            disabled={lines.length <= 1}>
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setLines((p) => [...p, blankLine()])}>
            <Plus className="size-4" />增加一行
          </Button>
          <div className="text-sm">
            合计: <span className="font-mono font-semibold text-lg ml-1">{formatCurrency(total)}</span>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">取消</Button></DialogClose>
          <Button onClick={handleSubmit} loading={submitting}>提交进货单</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 查看详情 ──────────────────────────────────────────────────────────
function ViewPurchaseDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [data, setData] = useState<Po & { items: PoItem[] } | null>(null);
  useEffect(() => {
    if (!id) { setData(null); return; }
    api.get<Po & { items: PoItem[] }>(`/purchases/${id}`).then(setData);
  }, [id]);

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>进货单详情</DialogTitle>
          <DialogDescription>{data?.order_no}</DialogDescription>
        </DialogHeader>
        {!data ? <Skeleton className="h-40" /> : (
          <>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><span className="text-muted-foreground">状态: </span><Badge variant={STATUS_META[data.status].variant}>{STATUS_META[data.status].label}</Badge></div>
              <div><span className="text-muted-foreground">供应商: </span>{data.supplier ?? '—'}</div>
              <div><span className="text-muted-foreground">金额: </span><span className="font-mono">{formatCurrency(data.total_amount)}</span></div>
              <div className="col-span-3"><span className="text-muted-foreground">创建于: </span>{formatDate(data.created_at)} · 操作员 {data.user?.real_name ?? '-'}</div>
              {/* D9: 展示触发器自动写入的状态变更时间, 完整呈现单据生命周期 */}
              {data.paid_at && (
                <div><span className="text-muted-foreground">付款时间: </span>{formatDate(data.paid_at)}</div>
              )}
              {data.received_at && (
                <div><span className="text-muted-foreground">入库时间: </span>{formatDate(data.received_at)}</div>
              )}
              {data.returned_at && (
                <div><span className="text-muted-foreground">退货时间: </span>{formatDate(data.returned_at)}</div>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono">ISBN</TableHead>
                  <TableHead>书名</TableHead>
                  <TableHead className="text-right">进货价</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="text-right">小计</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-mono text-xs">{it.isbn}</TableCell>
                    <TableCell>{it.title}</TableCell>
                    <TableCell className="text-right tabular">{formatCurrency(it.purchase_price)}</TableCell>
                    <TableCell className="text-right tabular">{it.quantity}</TableCell>
                    <TableCell className="text-right tabular">{formatCurrency(it.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── 入库对话框 ──────────────────────────────────────────────────────────
// PPT 要求: 新书首次入库必须填零售价. 已有书的零售价保持不变 (业务现实: 书的定价是物理属性).
// 后端 POST /purchases/:id/receive 接收 retail_prices 数组, 只对新书 (book_id IS NULL) 必填.
function ReceiveDialog({ id, onClose, onReceived }: {
  id: string | null;
  onClose: () => void;
  onReceived: () => void;
}) {
  const [data, setData] = useState<Po & { items: PoItem[] } | null>(null);
  const [newPrices, setNewPrices] = useState<Record<string, string>>({}); // key = item_id
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) { setData(null); setNewPrices({}); return; }
    api.get<Po & { items: PoItem[] }>(`/purchases/${id}`).then((d) => {
      setData(d);
      // 默认把新书零售价预填为「进货价 × 1.5」, 操作员可改
      const init: Record<string, string> = {};
      d.items.forEach((it) => {
        if (!it.book_id) {
          init[it.id] = (Number(it.purchase_price) * 1.5).toFixed(2);
        }
      });
      setNewPrices(init);
    }).catch((e) => toast.error(e instanceof Error ? e.message : '加载进货单详情失败'));
  }, [id]);

  const newItems = data?.items.filter((it) => !it.book_id) ?? [];
  const oldItems = data?.items.filter((it) => !!it.book_id) ?? [];

  const allFilled = newItems.every((it) => {
    const v = Number(newPrices[it.id]);
    return Number.isFinite(v) && v > 0;
  });

  const submit = async () => {
    if (!id) return;
    if (newItems.length > 0 && !allFilled) {
      toast.error('请为所有新书填写零售价 (大于 0)');
      return;
    }
    setSubmitting(true);
    try {
      const retail_prices = newItems.map((it) => ({
        item_id: Number(it.id),
        retail_price: Number(newPrices[it.id]),
      }));
      await api.post(`/purchases/${id}/receive`,
        retail_prices.length > 0 ? { retail_prices } : {});
      toast.success('入库成功');
      onReceived();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '入库失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>入库 · {data?.order_no ?? ''}</DialogTitle>
          <DialogDescription>
            新书首次入库需要填零售价。已有书的零售价保持不变, 如需调整请到「库存图书」页面手动编辑。
          </DialogDescription>
        </DialogHeader>

        {!data ? <Skeleton className="h-40" /> : (
          <div className="space-y-4">
            {newItems.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2 flex items-center gap-2">
                  🆕 新增书籍
                  <span className="text-xs text-muted-foreground font-normal">
                    ({newItems.length} 本, 零售价必填)
                  </span>
                </div>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left p-2 font-mono w-40">ISBN</th>
                        <th className="text-left p-2">书名</th>
                        <th className="text-right p-2 w-20">进货价</th>
                        <th className="text-right p-2 w-16">数量</th>
                        <th className="text-right p-2 w-32">
                          零售价 <span className="text-destructive">*</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {newItems.map((it) => (
                        <tr key={it.id} className="border-t">
                          <td className="p-2 font-mono text-xs">{it.isbn}</td>
                          <td className="p-2">{it.title}</td>
                          <td className="p-2 text-right tabular">{formatCurrency(it.purchase_price)}</td>
                          <td className="p-2 text-right tabular">{it.quantity}</td>
                          <td className="p-1.5">
                            <Input
                              className="h-8 text-right tabular"
                              type="number" min="0" step="0.01"
                              value={newPrices[it.id] ?? ''}
                              onChange={(e) => setNewPrices((p) => ({ ...p, [it.id]: e.target.value }))}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  💡 默认按「进货价 × 1.5」预填, 可调整为实际零售价
                </p>
              </div>
            )}

            {oldItems.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2 flex items-center gap-2">
                  📚 已有书籍
                  <span className="text-xs text-muted-foreground font-normal">
                    ({oldItems.length} 本, 沿用现有零售价)
                  </span>
                </div>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left p-2 font-mono w-40">ISBN</th>
                        <th className="text-left p-2">书名</th>
                        <th className="text-right p-2 w-20">进货价</th>
                        <th className="text-right p-2 w-16">数量</th>
                        <th className="text-right p-2 w-24">现有零售价</th>
                      </tr>
                    </thead>
                    <tbody>
                      {oldItems.map((it) => (
                        <tr key={it.id} className="border-t">
                          <td className="p-2 font-mono text-xs">{it.isbn}</td>
                          <td className="p-2">{it.title}</td>
                          <td className="p-2 text-right tabular">{formatCurrency(it.purchase_price)}</td>
                          <td className="p-2 text-right tabular">{it.quantity}</td>
                          <td className="p-2 text-right tabular text-muted-foreground">
                            {it.book ? formatCurrency(it.book.retail_price) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">取消</Button></DialogClose>
          <Button onClick={submit} loading={submitting}
                  disabled={!data || (newItems.length > 0 && !allFilled)}>
            确认入库
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

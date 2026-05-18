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
  book?: { id: string; title: string; stock: number } | null;
};
type Po = {
  id: string; order_no: string; supplier: string | null;
  status: PoStatus; total_amount: string | number;
  created_at: string;
  user?: { username: string; real_name: string };
  _count?: { items: number };
};
type ListResp = { total: number; page: number; pageSize: number; list: Po[] };

const PAGE_SIZE = 10;

const STATUS_META: Record<PoStatus, { label: string; variant: 'muted' | 'success' | 'warning' | 'destructive' }> = {
  pending:  { label: '未付款', variant: 'warning' },
  paid:     { label: '已付款', variant: 'default' as 'muted' },
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
      const msg = { pay: '付款', return: '退货', receive: '入库' }[action];
      if (!confirm(`确认${msg}?`)) return;
      await api.post(`/purchases/${id}/${action}`);
      toast.success(`${msg}成功`);
      fetchList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  return (
    <div>
      <PageHeader
        title="进货管理"
        description="四态流转: 未付款 → 已付款 → 已入库;未付款时可退货"
        action={
          <Button onClick={() => setOpenCreate(true)}>
            <Plus className="size-4" />新建进货单
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); setPage(1); }} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="pending">未付款</TabsTrigger>
          <TabsTrigger value="paid">已付款</TabsTrigger>
          <TabsTrigger value="received">已入库</TabsTrigger>
          <TabsTrigger value="returned">已退货</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading && !data ? (
        <Skeleton className="h-64" />
      ) : !data || data.total === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="暂无进货单"
          action={<Button onClick={() => setOpenCreate(true)}><Plus className="size-4" />新建第一张</Button>}
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44 font-mono">订单号</TableHead>
                <TableHead>供应商</TableHead>
                <TableHead className="w-24">明细</TableHead>
                <TableHead className="w-28 text-right">金额</TableHead>
                <TableHead className="w-24">状态</TableHead>
                <TableHead className="w-32">创建时间</TableHead>
                <TableHead className="w-24">操作员</TableHead>
                <TableHead className="w-64 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.list.map((p) => {
                const meta = STATUS_META[p.status];
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.order_no}</TableCell>
                    <TableCell>{p.supplier ?? <span className="text-muted-foreground/50">—</span>}</TableCell>
                    <TableCell>{p._count?.items ?? 0} 项</TableCell>
                    <TableCell className="text-right tabular">{formatCurrency(p.total_amount)}</TableCell>
                    <TableCell><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(p.created_at)}</TableCell>
                    <TableCell className="text-xs">{p.user?.real_name ?? '-'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewing(p.id)}>
                        <Eye className="size-4" />
                      </Button>
                      {p.status === 'pending' && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => doAction(p.id, 'pay')}>
                            <CreditCard className="size-3.5" />付款
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => doAction(p.id, 'return')}>
                            <Undo2 className="size-3.5" />退货
                          </Button>
                        </>
                      )}
                      {p.status === 'paid' && (
                        <Button variant="accent" size="sm" onClick={() => doAction(p.id, 'receive')}>
                          <Package className="size-3.5" />入库
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
    setSubmitting(true);
    try {
      await api.post('/purchases', {
        supplier: supplier || undefined,
        remark:   remark   || undefined,
        items: lines.map((l) => ({
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

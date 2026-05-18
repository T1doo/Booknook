'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Search, ShoppingCart, Plus, Minus, Trash2, Eye, ReceiptText,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { Pagination } from '@/components/layout/pagination';
import { EmptyState } from '@/components/empty-state';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

type Book = {
  id: string; isbn: string; title: string; author: string; retail_price: number | string; stock: number;
};
type CartLine = { book: Book; quantity: number };

type SaleOrder = {
  id: string; order_no: string; total_amount: string | number;
  customer_note: string | null; created_at: string;
  user?: { real_name: string };
  _count?: { items: number };
};

const PAGE_SIZE = 10;

export default function SalesPage() {
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<Book[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 销售单列表 (右侧 / 下方)
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<{ total: number; list: SaleOrder[] } | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    const r = await api.get<{ total: number; list: SaleOrder[] }>(`/sales?page=${page}&pageSize=${PAGE_SIZE}`);
    setOrders(r);
  }, [page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const doSearch = useCallback(async () => {
    if (!search.trim()) { setMatches([]); return; }
    const r = await api.get<{ list: Book[] }>(`/books?q=${encodeURIComponent(search.trim())}&field=all&pageSize=10`);
    setMatches(r.list);
  }, [search]);

  const addToCart = (b: Book) => {
    if (b.stock <= 0) { toast.error(`《${b.title}》库存不足`); return; }
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.book.id === b.id);
      if (idx >= 0) {
        const cur = prev[idx];
        if (cur.quantity >= b.stock) { toast.error(`已达最大库存`); return prev; }
        return prev.map((l, i) => i === idx ? { ...l, quantity: l.quantity + 1 } : l);
      }
      return [...prev, { book: b, quantity: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => prev.flatMap((l) => {
      if (l.book.id !== id) return [l];
      const next = l.quantity + delta;
      if (next <= 0) return [];
      if (next > l.book.stock) { toast.error('已达最大库存'); return [l]; }
      return [{ ...l, quantity: next }];
    }));
  };

  const removeLine = (id: string) => setCart((p) => p.filter((l) => l.book.id !== id));
  const cartTotal  = cart.reduce((s, l) => s + Number(l.book.retail_price) * l.quantity, 0);

  const checkout = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const r = await api.post<SaleOrder>('/sales', {
        customer_note: note || undefined,
        items: cart.map((l) => ({ book_id: Number(l.book.id), quantity: l.quantity })),
      });
      toast.success(`结账成功 · ${r.order_no}`);
      setCart([]); setNote(''); setMatches([]); setSearch('');
      fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '结账失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader title="销售收银" description="搜索图书 → 加入购物车 → 一键结账" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-6">
        {/* ─── 左侧: 搜索与结果 ──────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="size-4" />检索图书
              </CardTitle>
              <CardDescription>支持书名 / 作者 / 出版社 / ISBN</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="书名 / 作者 / ISBN…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }}
                />
                <Button onClick={doSearch}><Search className="size-4" />搜索</Button>
              </div>

              {matches.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  输入关键词后回车,或点击搜索按钮
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {matches.map((b) => (
                    <li key={b.id} className="flex items-center justify-between py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{b.title}</div>
                        <div className="text-xs text-muted-foreground flex gap-3 mt-0.5">
                          <span>{b.author}</span>
                          <span className="font-mono">{b.isbn}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant={b.stock <= 0 ? 'destructive' : 'muted'} className="tabular">
                          库存 {b.stock}
                        </Badge>
                        <span className="font-mono w-20 text-right">{formatCurrency(b.retail_price)}</span>
                        <Button size="sm" disabled={b.stock <= 0} onClick={() => addToCart(b)}>
                          <Plus className="size-4" />加入
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* 最近销售 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ReceiptText className="size-4" />近期销售单
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!orders ? (
                <Skeleton className="h-32" />
              ) : orders.total === 0 ? (
                <EmptyState title="还没有销售记录" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono">订单号</TableHead>
                      <TableHead>时间</TableHead>
                      <TableHead>操作员</TableHead>
                      <TableHead>明细</TableHead>
                      <TableHead className="text-right">金额</TableHead>
                      <TableHead className="text-right w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.list.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.order_no}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(o.created_at)}</TableCell>
                        <TableCell className="text-xs">{o.user?.real_name}</TableCell>
                        <TableCell>{o._count?.items ?? 0} 项</TableCell>
                        <TableCell className="text-right tabular">{formatCurrency(o.total_amount)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => setViewing(o.id)}>
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {orders && orders.total > 0 && (
                <Pagination page={page} pageSize={PAGE_SIZE} total={orders.total} onPageChange={setPage} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── 右侧: 购物车 ──────────────────────────────────────── */}
        <Card className="h-fit sticky top-20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShoppingCart className="size-4" />购物车
              </span>
              <Badge variant="muted" className="tabular">{cart.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">购物车为空</p>
            ) : cart.map((l) => (
              <div key={l.book.id} className="flex items-center gap-2 pb-3 border-b last:border-b-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{l.book.title}</div>
                  <div className="text-xs text-muted-foreground tabular">
                    {formatCurrency(l.book.retail_price)} × {l.quantity}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => updateQty(l.book.id, -1)}>
                    <Minus className="size-3.5" />
                  </Button>
                  <span className="w-6 text-center text-sm tabular">{l.quantity}</span>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => updateQty(l.book.id, 1)}>
                    <Plus className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => removeLine(l.book.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            {cart.length > 0 && (
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="客户备注 (选填)" />
            )}
          </CardContent>
          <CardFooter className="flex-col gap-3 items-stretch border-t pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">合计</span>
              <span className="font-mono font-semibold text-2xl">{formatCurrency(cartTotal)}</span>
            </div>
            <Button className="w-full" size="lg" disabled={cart.length === 0 || submitting} loading={submitting} onClick={checkout}>
              结账
            </Button>
          </CardFooter>
        </Card>
      </div>

      <ViewSaleDialog id={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function ViewSaleDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  type SaleDetail = SaleOrder & {
    items: { id: string; quantity: number; unit_price: number | string; subtotal: number | string;
      book: { id: string; isbn: string; title: string; author: string } }[];
  };
  const [data, setData] = useState<SaleDetail | null>(null);
  useEffect(() => {
    if (!id) { setData(null); return; }
    api.get<SaleDetail>(`/sales/${id}`).then(setData);
  }, [id]);

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>销售单详情</DialogTitle>
          <DialogDescription>{data?.order_no}</DialogDescription>
        </DialogHeader>
        {!data ? <Skeleton className="h-40" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono">ISBN</TableHead>
                <TableHead>书名</TableHead>
                <TableHead className="text-right">单价</TableHead>
                <TableHead className="text-right">数量</TableHead>
                <TableHead className="text-right">小计</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-mono text-xs">{it.book.isbn}</TableCell>
                  <TableCell>{it.book.title}</TableCell>
                  <TableCell className="text-right tabular">{formatCurrency(it.unit_price)}</TableCell>
                  <TableCell className="text-right tabular">{it.quantity}</TableCell>
                  <TableCell className="text-right tabular">{formatCurrency(it.subtotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

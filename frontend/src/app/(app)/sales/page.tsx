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
import { formatCurrency, formatDate, toCnRangeIso } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { useT } from '@/i18n';

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
  const t = useT();
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<Book[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // D6: 结账失败时高亮哪一行书库存不足
  const [errorBookId, setErrorBookId] = useState<string | null>(null);

  // 销售单列表 (右侧 / 下方)
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<{ total: number; list: SaleOrder[] } | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  // D7: 销售单按日期范围筛选
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchOrders = useCallback(async () => {
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    const range = toCnRangeIso(from, to);
    if (range.from) qs.set('from', range.from);
    if (range.to) qs.set('to', range.to);
    const r = await api.get<{ total: number; list: SaleOrder[] }>(`/sales?${qs}`);
    setOrders(r);
  }, [page, from, to]);

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

  // D6: 购物车任何变更后清掉错误高亮
  useEffect(() => { setErrorBookId(null); }, [cart]);

  const checkout = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    setErrorBookId(null);
    try {
      const r = await api.post<SaleOrder>('/sales', {
        customer_note: note || undefined,
        items: cart.map((l) => ({ book_id: Number(l.book.id), quantity: l.quantity })),
      });
      toast.success(`结账成功 · ${r.order_no}`);
      setCart([]); setNote(''); setMatches([]); setSearch('');
      fetchOrders();
    } catch (err) {
      const message = err instanceof Error ? err.message : '结账失败';
      toast.error(message);
      // D6: 解析后端"《xxx》库存不足"提示, 把购物车里对应行标红
      const m = /《([^》]+)》/.exec(message);
      if (m) {
        const hit = cart.find((l) => l.book.title === m[1]);
        if (hit) setErrorBookId(hit.book.id);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader title={t('sale.title_page')} description={t('sale.desc_page')} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-6">
        {/* ─── 左侧: 搜索与结果 ──────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="size-4" />{t('sale.search_title')}
              </CardTitle>
              <CardDescription>{t('sale.search_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="书名 / 作者 / ISBN…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }}
                />
                <Button onClick={doSearch}><Search className="size-4" />{t('common.search')}</Button>
              </div>

              {matches.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  {t('sale.search_hint')}
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
                          {t('sale.stock_label')} {b.stock}
                        </Badge>
                        <span className="font-mono w-20 text-right">{formatCurrency(b.retail_price)}</span>
                        <Button size="sm" disabled={b.stock <= 0} onClick={() => addToCart(b)}>
                          <Plus className="size-4" />{t('sale.add_to_cart')}
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
                <ReceiptText className="size-4" />{t('sale.recent_orders')}
              </CardTitle>
              {/* D7: 日期范围筛选 */}
              <div className="flex flex-wrap items-end gap-2 pt-3">
                <div className="space-y-1">
                  <Label htmlFor="sales-from" className="text-xs">起始</Label>
                  <Input id="sales-from" type="date" className="h-8 w-36"
                         value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sales-to" className="text-xs">截止</Label>
                  <Input id="sales-to" type="date" className="h-8 w-36"
                         value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
                </div>
                {(from || to) && (
                  <Button variant="outline" size="sm" onClick={() => { setFrom(''); setTo(''); setPage(1); }}>
                    清空
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!orders ? (
                <Skeleton className="h-32" />
              ) : orders.total === 0 ? (
                <EmptyState title={t('sale.no_orders')} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono">{t('sale.order_no')}</TableHead>
                      <TableHead>{t('common.time')}</TableHead>
                      <TableHead>{t('common.operator')}</TableHead>
                      <TableHead>{t('sale.items')}</TableHead>
                      <TableHead className="text-right">{t('sale.amount')}</TableHead>
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
                <ShoppingCart className="size-4" />{t('sale.cart')}
              </span>
              <Badge variant="muted" className="tabular">{cart.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t('sale.cart_empty')}</p>
            ) : cart.map((l) => (
              <div
                key={l.book.id}
                className={`flex items-center gap-2 pb-3 border-b last:border-b-0 last:pb-0 ${
                  errorBookId === l.book.id ? 'bg-destructive/10 -mx-3 px-3 rounded' : ''
                }`}
              >
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
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('sale.customer_note')} maxLength={100} />
            )}
          </CardContent>
          <CardFooter className="flex-col gap-3 items-stretch border-t pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">{t('sale.total')}</span>
              <span className="font-mono font-semibold text-2xl">{formatCurrency(cartTotal)}</span>
            </div>
            <Button className="w-full" size="lg" disabled={cart.length === 0 || submitting} loading={submitting} onClick={checkout}>
              {t('sale.checkout')}
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

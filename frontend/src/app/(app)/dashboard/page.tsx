'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp, TrendingDown, Package, Wallet, BookText, Bell, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendChart, HBarChart, DualBarChart, CategoryPie } from '@/components/charts';
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/api';
import { useT } from '@/i18n';

type DashboardData = {
  today: { sales: number; orders: number };
  month: { sales: number; orders: number };
  stock: { totalStock: number; titles: number };
  pendingPurchase: { amount: number; count: number };
  alertsCount: number;
};

type SalesTrendItem = { day: string; total_amount: number; order_count: number };
type TopBookItem = { title: string; sold_qty: number; sold_amount: number };
type FinanceMonthItem = { month: string; income: number; expense: number; net: number };
type CategoryItem = { category: string; titles: number; stock: number };
type AlertItem = {
  id: string; book_id: string; threshold: number; current_stock: number;
  book: { title: string; isbn: string; stock: number };
};

export default function DashboardPage() {
  const t = useT();
  const [data, setData] = useState<DashboardData | null>(null);
  const [trend, setTrend] = useState<SalesTrendItem[]>([]);
  const [top, setTop] = useState<TopBookItem[]>([]);
  const [finance, setFinance] = useState<FinanceMonthItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  useEffect(() => {
    // 拆成独立 then/catch, 单个接口失败不影响其他卡片渲染, 并能 toast 报错
    const handle = (label: string) => (e: Error) =>
      toast.error(`${label}加载失败: ${e.message}`);
    api.get<DashboardData>('/analytics/dashboard').then(setData).catch(handle('KPI'));
    api.get<SalesTrendItem[]>('/analytics/sales-trend').then(setTrend).catch(handle('销售趋势'));
    api.get<TopBookItem[]>('/analytics/top-books').then(setTop).catch(handle('畅销榜'));
    api.get<FinanceMonthItem[]>('/analytics/finance-monthly').then(setFinance).catch(handle('月度财务'));
    api.get<CategoryItem[]>('/analytics/category').then(setCategories).catch(handle('库存分类'));
    api.get<AlertItem[]>('/alerts').then(setAlerts).catch(handle('库存预警'));
  }, []);

  return (
    <div className="space-y-6">
      {/* ─── 顶部欢迎 ──────────────────────────────────────────── */}
      <header className="flex items-baseline justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold">概览</h2>
          <p className="text-sm text-muted-foreground mt-1">
            欢迎回来,这里是您的暖书阁经营概况。
          </p>
        </div>
        <Badge variant="muted" className="font-mono">
          {new Date().toLocaleString('zh-CN', { dateStyle: 'long', timeStyle: 'short' })}
        </Badge>
      </header>

      {/* ─── KPI 四卡 ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={t('dashboard.today_sales')}
          value={data ? formatCurrency(data.today.sales) : null}
          sub={data ? `${data.today.orders} 单` : '—'}
          icon={<TrendingUp className="size-4" />}
          accent="amber"
        />
        <KpiCard
          label={t('dashboard.month_sales')}
          value={data ? formatCurrency(data.month.sales) : null}
          sub={data ? `${data.month.orders} 单` : '—'}
          icon={<Wallet className="size-4" />}
          accent="green"
        />
        <KpiCard
          label={t('dashboard.total_stock')}
          value={data ? data.stock.totalStock.toLocaleString() : null}
          sub={data ? `${data.stock.titles} 个品类` : '—'}
          icon={<Package className="size-4" />}
          accent="blue"
        />
        <KpiCard
          label={t('dashboard.pending_purchase')}
          value={data ? formatCurrency(data.pendingPurchase.amount) : null}
          sub={data ? `${data.pendingPurchase.count} 张待付` : '—'}
          icon={<BookText className="size-4" />}
          accent="rose"
        />
      </div>

      {/* ─── 30 天销售趋势 ──────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">{t('dashboard.sales_trend')}</CardTitle>
            <CardDescription>近 30 天日销售额(¥)</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {trend.length > 0
            ? <TrendChart data={trend} xKey="day" yKey="total_amount" />
            : <Skeleton className="h-[260px] w-full" />}
        </CardContent>
      </Card>

      {/* ─── 双图表行 ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('dashboard.top_books')}</CardTitle>
            <CardDescription>按销售册数</CardDescription>
          </CardHeader>
          <CardContent>
            {top.length > 0
              ? <HBarChart data={top.map(t => ({ ...t, title: t.title.length > 14 ? t.title.slice(0,12)+'…' : t.title }))} xKey="sold_qty" yKey="title" />
              : <EmptyChart text="暂无销售数据" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('dashboard.finance_monthly')}</CardTitle>
            <CardDescription>收入 / 支出 (¥)</CardDescription>
          </CardHeader>
          <CardContent>
            {finance.length > 0
              ? <DualBarChart data={finance} xKey="month" />
              : <EmptyChart text="暂无财务数据" />}
          </CardContent>
        </Card>
      </div>

      {/* ─── 库存分类 + 预警 ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('dashboard.category_pie')}</CardTitle>
            <CardDescription>按库存数量</CardDescription>
          </CardHeader>
          <CardContent>
            {categories.length > 0
              ? <CategoryPie data={categories} />
              : <Skeleton className="h-[260px] w-full" />}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="size-4 text-destructive" />
                {t('dashboard.alerts')}
              </CardTitle>
              <CardDescription>库存低于阈值的书籍</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/alerts">
                <span className="inline-flex items-center gap-1">
                  查看全部 <ArrowRight className="size-3.5" />
                </span>
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                ✓ 当前所有书籍库存充足
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {alerts.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2.5">
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate">{a.book.title}</span>
                      <span className="text-xs text-muted-foreground font-mono">{a.book.isbn}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <Badge variant="warning" className="tabular">
                        {a.current_stock} / {a.threshold}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  label, value, sub, icon, accent,
}: {
  label: string; value: string | null; sub: string;
  icon: React.ReactNode;
  accent: 'amber' | 'green' | 'blue' | 'rose';
}) {
  const accents: Record<string, string> = {
    amber:  'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    green:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    blue:   'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
    rose:   'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  };
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
          <span className={`size-8 rounded-md flex items-center justify-center ${accents[accent]}`}>
            {icon}
          </span>
        </div>
        {value == null
          ? <Skeleton className="h-8 w-32 mb-1" />
          : <div className="font-serif text-3xl font-semibold tabular tracking-tight">{value}</div>}
        <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

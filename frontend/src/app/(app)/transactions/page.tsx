'use client';

import { useCallback, useEffect, useState } from 'react';
import { Receipt, TrendingUp, TrendingDown, Calendar } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/layout/page-header';
import { Pagination } from '@/components/layout/pagination';
import { EmptyState } from '@/components/empty-state';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, toCnRangeIso } from '@/lib/utils';
import { useT } from '@/i18n';

type Tx = {
  id: string; type: 'income' | 'expense'; amount: string | number;
  description: string; created_at: string;
  user?: { real_name: string };
};
type Resp = {
  total: number; page: number; pageSize: number; list: Tx[];
  summary: { income: number; expense: number; income_count: number; expense_count: number };
};

const PAGE_SIZE = 20;

export default function TransactionsPage() {
  const t = useT();
  const [tab, setTab] = useState<'all' | 'income' | 'expense'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (tab !== 'all') qs.set('type', tab);
      // D4: 用 toCnRangeIso 把"本地一整天"完整覆盖, 避免时区飘移漏数据
      const range = toCnRangeIso(from, to);
      if (range.from) qs.set('from', range.from);
      if (range.to)   qs.set('to',   range.to);
      const r = await api.get<Resp>(`/transactions?${qs}`);
      setData(r);
    } finally {
      setLoading(false);
    }
  }, [tab, from, to, page]);

  useEffect(() => { fetchList(); }, [fetchList]);

  return (
    <div>
      <PageHeader title={t('transaction.title_page')} description={t('transaction.desc_page')} />

      {/* 汇总 KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <SummaryCard icon={TrendingUp} label={t('transaction.income_total')}  value={data?.summary.income} count={data?.summary.income_count} color="emerald" />
        <SummaryCard icon={TrendingDown} label={t('transaction.expense_total')} value={data?.summary.expense} count={data?.summary.expense_count} color="rose" />
        <SummaryCard icon={Receipt} label={t('transaction.net')}
          value={data ? data.summary.income - data.summary.expense : undefined}
          count={data ? data.summary.income_count + data.summary.expense_count : undefined}
          color="amber" />
      </div>

      {/* 筛选 */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
            <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); setPage(1); }}>
              <TabsList>
                <TabsTrigger value="all">{t('transaction.filter_all')}</TabsTrigger>
                <TabsTrigger value="income">{t('transaction.income')}</TabsTrigger>
                <TabsTrigger value="expense">{t('transaction.expense')}</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="space-y-1.5">
              <Label htmlFor="from">{t('common.from_date')}</Label>
              <Input id="from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">{t('common.to_date')}</Label>
              <Input id="to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
            </div>
            <Button variant="outline" onClick={() => { setFrom(''); setTo(''); setTab('all'); setPage(1); }}>
              {t('common.reset')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && !data ? (
        <Skeleton className="h-64" />
      ) : !data || data.total === 0 ? (
        <EmptyState icon={Calendar} title={t('transaction.empty')} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.time')}</TableHead>
                <TableHead>{t('transaction.type')}</TableHead>
                <TableHead className="text-right">{t('transaction.amount')}</TableHead>
                <TableHead>{t('transaction.description')}</TableHead>
                <TableHead>{t('common.operator')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.list.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</TableCell>
                  <TableCell>
                    <Badge variant={tx.type === 'income' ? 'success' : 'destructive'}>
                      {tx.type === 'income' ? t('transaction.income') : t('transaction.expense')}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right tabular font-medium ${tx.type === 'income' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                    {tx.type === 'income' ? '+' : '−'} {formatCurrency(tx.amount)}
                  </TableCell>
                  <TableCell>{tx.description}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{tx.user?.real_name ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon, label, value, count, color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: number;
  count?: number;
  color: 'emerald' | 'rose' | 'amber';
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    rose:    'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    amber:   'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  };
  return (
    <Card>
      <CardContent className="pt-6 flex items-center gap-4">
        <div className={`size-12 rounded-md flex items-center justify-center ${colors[color]}`}>
          <Icon className="size-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="font-serif text-2xl font-semibold tabular">{value != null ? formatCurrency(value) : '—'}</div>
          {count != null && <div className="text-xs text-muted-foreground mt-0.5">{count} 笔</div>}
        </div>
      </CardContent>
    </Card>
  );
}

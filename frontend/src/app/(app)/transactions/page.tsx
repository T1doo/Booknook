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
import { formatCurrency, formatDate } from '@/lib/utils';

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
      if (from) qs.set('from', new Date(from).toISOString());
      if (to)   qs.set('to',   new Date(to + 'T23:59:59').toISOString());
      const r = await api.get<Resp>(`/transactions?${qs}`);
      setData(r);
    } finally {
      setLoading(false);
    }
  }, [tab, from, to, page]);

  useEffect(() => { fetchList(); }, [fetchList]);

  return (
    <div>
      <PageHeader title="财务账单" description="按日期范围与类型筛选所有收入支出流水" />

      {/* 汇总 KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <SummaryCard icon={TrendingUp} label="收入合计"  value={data?.summary.income} count={data?.summary.income_count} color="emerald" />
        <SummaryCard icon={TrendingDown} label="支出合计" value={data?.summary.expense} count={data?.summary.expense_count} color="rose" />
        <SummaryCard icon={Receipt} label="净收益"
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
                <TabsTrigger value="all">全部</TabsTrigger>
                <TabsTrigger value="income">收入</TabsTrigger>
                <TabsTrigger value="expense">支出</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="space-y-1.5">
              <Label htmlFor="from">起始日期</Label>
              <Input id="from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">截止日期</Label>
              <Input id="to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
            </div>
            <Button variant="outline" onClick={() => { setFrom(''); setTo(''); setTab('all'); setPage(1); }}>
              重置
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && !data ? (
        <Skeleton className="h-64" />
      ) : !data || data.total === 0 ? (
        <EmptyState icon={Calendar} title="该范围内没有流水" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>类型</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>操作员</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.list.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</TableCell>
                  <TableCell>
                    <Badge variant={tx.type === 'income' ? 'success' : 'destructive'}>
                      {tx.type === 'income' ? '收入' : '支出'}
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

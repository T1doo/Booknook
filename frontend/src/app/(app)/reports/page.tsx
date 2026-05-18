'use client';

import { useState } from 'react';
import { FileSpreadsheet, FileText, Download, ShoppingBag, ShoppingCart, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/layout/page-header';
import { downloadFile } from '@/lib/api';

export default function ReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const dl = async (key: string, path: string, filename: string) => {
    setBusy(key);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set('from', new Date(from).toISOString());
      if (to)   qs.set('to',   new Date(to + 'T23:59:59').toISOString());
      await downloadFile(`${path}?${qs}`, filename);
      toast.success('已开始下载');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '下载失败');
    } finally {
      setBusy(null);
    }
  };

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader title="报表导出" description="按日期范围导出 Excel / PDF 报表" />

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">日期筛选</CardTitle>
          <CardDescription>留空表示导出全部数据</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="r-from">起始日期</Label>
            <Input id="r-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-to">截止日期</Label>
            <Input id="r-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => { setFrom(''); setTo(''); }}>清空</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportCard
          icon={ShoppingCart} title="销售报表"
          desc="所有销售单的明细 (XLSX)"
          color="emerald"
          busy={busy === 'sales'}
          onClick={() => dl('sales', '/reports/sales.xlsx', `sales-${stamp}.xlsx`)}
        />
        <ReportCard
          icon={ShoppingBag} title="进货报表"
          desc="所有进货单的明细 (XLSX)"
          color="amber"
          busy={busy === 'purchases'}
          onClick={() => dl('purchases', '/reports/purchases.xlsx', `purchases-${stamp}.xlsx`)}
        />
        <ReportCard
          icon={Wallet} title="财务流水 (XLSX)"
          desc="所有收入支出明细"
          color="sky"
          busy={busy === 'finance-xlsx'}
          onClick={() => dl('finance-xlsx', '/reports/finance.xlsx', `finance-${stamp}.xlsx`)}
        />
        <ReportCard
          icon={FileText} title="财务流水 (PDF)"
          desc="可直接打印的精美 PDF"
          color="rose"
          busy={busy === 'finance-pdf'}
          onClick={() => dl('finance-pdf', '/reports/finance.pdf', `finance-${stamp}.pdf`)}
        />
      </div>
    </div>
  );
}

function ReportCard({
  icon: Icon, title, desc, color, onClick, busy,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; desc: string;
  color: 'emerald' | 'amber' | 'sky' | 'rose';
  onClick: () => void;
  busy: boolean;
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    amber:   'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    sky:     'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
    rose:    'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  };
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className={`size-10 rounded-md flex items-center justify-center ${colors[color]}`}>
            <Icon className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-0.5">{desc}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardFooter>
        <Button onClick={onClick} loading={busy} className="ml-auto">
          <Download className="size-4" />导出
        </Button>
      </CardFooter>
    </Card>
  );
}

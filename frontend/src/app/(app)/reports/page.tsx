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
import { toCnRangeIso } from '@/lib/utils';
import { useT } from '@/i18n';

export default function ReportsPage() {
  const t = useT();
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const dl = async (key: string, path: string, filename: string) => {
    setBusy(key);
    try {
      const qs = new URLSearchParams();
      // D4: 用 toCnRangeIso 把"本地一整天"完整覆盖, 避免跨日时区漏数据
      const range = toCnRangeIso(from, to);
      if (range.from) qs.set('from', range.from);
      if (range.to)   qs.set('to',   range.to);
      await downloadFile(`${path}?${qs}`, filename);
      toast.success(t('report.download_start'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('report.download_failed'));
    } finally {
      setBusy(null);
    }
  };

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader title={t('report.title_page')} description={t('report.desc_page')} />

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('report.filter_title')}</CardTitle>
          <CardDescription>{t('report.filter_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="r-from">{t('common.from_date')}</Label>
            <Input id="r-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-to">{t('common.to_date')}</Label>
            <Input id="r-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => { setFrom(''); setTo(''); }}>{t('common.clear')}</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportCard
          icon={ShoppingCart} title={t('report.sales_title')}
          desc={t('report.sales_desc')}
          color="emerald"
          busy={busy === 'sales'}
          onClick={() => dl('sales', '/reports/sales.xlsx', `sales-${stamp}.xlsx`)}
        />
        <ReportCard
          icon={ShoppingBag} title={t('report.purchase_title')}
          desc={t('report.purchase_desc')}
          color="amber"
          busy={busy === 'purchases'}
          onClick={() => dl('purchases', '/reports/purchases.xlsx', `purchases-${stamp}.xlsx`)}
        />
        <ReportCard
          icon={Wallet} title={t('report.finance_xlsx_title')}
          desc={t('report.finance_xlsx_desc')}
          color="sky"
          busy={busy === 'finance-xlsx'}
          onClick={() => dl('finance-xlsx', '/reports/finance.xlsx', `finance-${stamp}.xlsx`)}
        />
        <ReportCard
          icon={FileText} title={t('report.finance_pdf_title')}
          desc={t('report.finance_pdf_desc')}
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

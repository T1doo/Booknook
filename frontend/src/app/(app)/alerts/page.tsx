'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCircle2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/empty-state';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useT } from '@/i18n';

type Alert = {
  id: string; book_id: string; threshold: number; current_stock: number;
  last_alerted_at: string;
  book: { id: string; isbn: string; title: string; author: string; stock: number; low_stock_threshold: number };
};

export default function AlertsPage() {
  const t = useT();
  const [list, setList] = useState<Alert[] | null>(null);
  const [editing, setEditing] = useState<Alert | null>(null);

  const fetchList = useCallback(async () => {
    const r = await api.get<Alert[]>('/alerts');
    setList(r);
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  const resolve = async (id: string) => {
    try {
      await api.post(`/alerts/${id}/resolve`);
      toast.success('已标记为已处理');
      fetchList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  return (
    <div>
      <PageHeader
        title={t('alert.title_page')}
        description={t('alert.desc_page')}
      />

      {!list ? (
        <Skeleton className="h-64" />
      ) : list.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={t('alert.empty')}
        />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="size-4 text-destructive" />
              {list.length}
            </CardTitle>
            <CardDescription>{t('alert.desc_page')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono">{t('book.isbn')}</TableHead>
                  <TableHead>{t('book.title')}</TableHead>
                  <TableHead>{t('book.author')}</TableHead>
                  <TableHead className="text-right">{t('alert.current_stock')} / {t('alert.threshold')}</TableHead>
                  <TableHead className="text-right">{t('alert.alert_time')}</TableHead>
                  <TableHead className="text-right w-44">{t('common.operations')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.book.isbn}</TableCell>
                    <TableCell className="font-medium">{a.book.title}</TableCell>
                    <TableCell>{a.book.author}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="warning" className="tabular">
                        {a.current_stock} / {a.threshold}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{formatDate(a.last_alerted_at)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="sm" onClick={() => setEditing(a)}>
                        <Settings2 className="size-3.5" />{t('alert.edit_threshold')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => resolve(a.id)}>
                        <CheckCircle2 className="size-3.5" />{t('alert.resolve')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ThresholdDialog alert={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); fetchList(); }} />
    </div>
  );
}

function ThresholdDialog({ alert, onClose, onSaved }: { alert: Alert | null; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (alert) setValue(String(alert.threshold)); }, [alert]);

  const submit = async () => {
    if (!alert) return;
    setBusy(true);
    try {
      await api.patch(`/alerts/threshold/${alert.book.id}`, { low_stock_threshold: Number(value) });
      toast.success('已更新');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '更新失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!alert} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>修改库存阈值</DialogTitle>
        </DialogHeader>
        {alert && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              《{alert.book.title}》当前库存 <b>{alert.current_stock}</b>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="th">新的阈值</Label>
              <Input id="th" type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} />
              <p className="text-xs text-muted-foreground">设为 0 即不再预警;阈值低于当前库存时,预警将自动解除。</p>
            </div>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">取消</Button></DialogClose>
          <Button onClick={submit} loading={busy}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

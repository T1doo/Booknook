'use client';

import { useCallback, useEffect, useState } from 'react';
import { ScrollText, Search } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { PageHeader } from '@/components/layout/page-header';
import { Pagination } from '@/components/layout/pagination';
import { EmptyState } from '@/components/empty-state';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type Log = {
  id: string; user_id: string | null;
  action: string; resource: string; resource_id: string | null;
  ip: string | null; payload: Record<string, unknown> | null;
  created_at: string;
  user?: { username: string; real_name: string };
};

const PAGE_SIZE = 30;

const ACTION_LABEL: Record<string, string> = {
  create: '新建', update: '更新', delete: '删除',
  pay: '付款', return: '退货', receive: '入库', resolve: '处理',
};

const RES_LABEL: Record<string, string> = {
  books: '图书', users: '用户',
  purchases: '进货单', sales: '销售单',
  alerts: '预警',
};

export default function LogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [resource, setResource] = useState('');
  const [data, setData] = useState<{ total: number; list: Log[] } | null>(null);

  const fetchList = useCallback(async () => {
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (action) qs.set('action', action);
    if (resource) qs.set('resource', resource);
    const r = await api.get<{ total: number; list: Log[] }>(`/logs?${qs}`);
    setData(r);
  }, [page, action, resource]);

  useEffect(() => { fetchList(); }, [fetchList]);

  return (
    <div>
      <PageHeader
        title="操作日志"
        description="所有写入操作的全链路审计 · JSONB 完整入参留存"
      />

      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>动作</Label>
              <Select value={action || 'any'} onValueChange={(v) => { setAction(v === 'any' ? '' : v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="全部" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">全部</SelectItem>
                  {Object.entries(ACTION_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>资源</Label>
              <Select value={resource || 'any'} onValueChange={(v) => { setResource(v === 'any' ? '' : v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="全部" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">全部</SelectItem>
                  {Object.entries(RES_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div />
            <Button variant="outline" onClick={() => { setAction(''); setResource(''); setPage(1); }}>重置</Button>
          </div>
        </CardContent>
      </Card>

      {!data ? (
        <Skeleton className="h-64" />
      ) : data.total === 0 ? (
        <EmptyState icon={ScrollText} title="没有匹配的日志" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">时间</TableHead>
                <TableHead className="w-32">用户</TableHead>
                <TableHead className="w-24">动作</TableHead>
                <TableHead className="w-28">资源</TableHead>
                <TableHead className="w-20">资源 ID</TableHead>
                <TableHead>载荷</TableHead>
                <TableHead className="w-32 font-mono">IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.list.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground tabular">{formatDate(log.created_at)}</TableCell>
                  <TableCell className="text-sm">
                    {log.user ? (
                      <span>
                        <span className="font-medium">{log.user.real_name}</span>
                        <span className="text-muted-foreground"> @{log.user.username}</span>
                      </span>
                    ) : <span className="text-muted-foreground/50">—</span>}
                  </TableCell>
                  <TableCell><Badge variant="muted">{ACTION_LABEL[log.action] ?? log.action}</Badge></TableCell>
                  <TableCell>{RES_LABEL[log.resource] ?? log.resource}</TableCell>
                  <TableCell className="font-mono text-xs">{log.resource_id ?? '—'}</TableCell>
                  <TableCell>
                    <code className="text-xs text-muted-foreground line-clamp-1 max-w-md block">
                      {log.payload && Object.keys(log.payload).length > 0 ? JSON.stringify(log.payload) : '—'}
                    </code>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{log.ip ?? '—'}</TableCell>
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

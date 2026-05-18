'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Pencil, Trash2, Library, PackageX } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/layout/page-header';
import { Pagination } from '@/components/layout/pagination';
import { EmptyState } from '@/components/empty-state';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useT } from '@/i18n';

type Book = {
  id: string; isbn: string; title: string; publisher: string; author: string;
  retail_price: string | number; stock: number; low_stock_threshold: number;
  category: string | null; updated_at: string;
};
type ListResp = { total: number; page: number; pageSize: number; list: Book[] };

const PAGE_SIZE = 15;

export default function BooksPage() {
  const t = useT();
  const [page, setPage] = useState(1);
  const [field, setField] = useState<'all' | 'id' | 'isbn' | 'title' | 'author' | 'publisher'>('all');
  const [q, setQ] = useState('');
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<ListResp>(
        `/books?page=${page}&pageSize=${PAGE_SIZE}&field=${field}` +
          (q ? `&q=${encodeURIComponent(q)}` : ''),
      );
      setData(r);
    } finally {
      setLoading(false);
    }
  }, [page, field, q]);

  useEffect(() => { fetchList(); }, [fetchList]);

  return (
    <div>
      <PageHeader title="库存图书" description="管理整个书城所有在库书籍" />

      {/* 搜索栏 */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Select value={field} onValueChange={(v) => { setField(v as typeof field); setPage(1); }}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('book.search_field.all')}</SelectItem>
            <SelectItem value="id">{t('book.search_field.id')}</SelectItem>
            <SelectItem value="isbn">{t('book.search_field.isbn')}</SelectItem>
            <SelectItem value="title">{t('book.search_field.title')}</SelectItem>
            <SelectItem value="author">{t('book.search_field.author')}</SelectItem>
            <SelectItem value="publisher">{t('book.search_field.publisher')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t('common.search_placeholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchList(); } }}
          />
        </div>
        <Button onClick={() => { setPage(1); fetchList(); }}>
          <Search className="size-4" />查询
        </Button>
      </div>

      {/* 表格 */}
      {loading && !data ? (
        <Skeleton className="h-64" />
      ) : !data || data.total === 0 ? (
        <EmptyState
          icon={PackageX}
          title="未找到相关书籍"
          description="试试更换关键词,或清空筛选条件"
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>书名</TableHead>
                <TableHead className="w-36 font-mono">ISBN</TableHead>
                <TableHead className="w-28">作者</TableHead>
                <TableHead className="w-32">出版社</TableHead>
                <TableHead className="w-24">分类</TableHead>
                <TableHead className="w-24 text-right">零售价</TableHead>
                <TableHead className="w-24 text-right">库存</TableHead>
                <TableHead className="w-24 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.list.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="text-muted-foreground tabular">{b.id}</TableCell>
                  <TableCell className="font-medium">{b.title}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{b.isbn}</TableCell>
                  <TableCell>{b.author}</TableCell>
                  <TableCell className="text-muted-foreground">{b.publisher}</TableCell>
                  <TableCell>
                    {b.category ? <Badge variant="muted">{b.category}</Badge> : <span className="text-muted-foreground/50">—</span>}
                  </TableCell>
                  <TableCell className="text-right tabular">{formatCurrency(b.retail_price)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={b.stock <= b.low_stock_threshold ? 'warning' : b.stock === 0 ? 'destructive' : 'success'} className="tabular">
                      {b.stock}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(b)} title="编辑">
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
        </>
      )}

      {/* 编辑对话框 */}
      <EditBookDialog book={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); fetchList(); }} />
    </div>
  );
}

// ─── 编辑对话框 ──────────────────────────────────────────────────────
function EditBookDialog({
  book, onClose, onSaved,
}: {
  book: Book | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle]                       = useState('');
  const [author, setAuthor]                     = useState('');
  const [publisher, setPublisher]               = useState('');
  const [retailPrice, setRetailPrice]           = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [category, setCategory]                 = useState('');
  const [submitting, setSubmitting]             = useState(false);

  useEffect(() => {
    if (book) {
      setTitle(book.title);
      setAuthor(book.author);
      setPublisher(book.publisher);
      setRetailPrice(String(book.retail_price));
      setLowStockThreshold(String(book.low_stock_threshold));
      setCategory(book.category ?? '');
    }
  }, [book]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!book) return;
    setSubmitting(true);
    try {
      await api.patch(`/books/${book.id}`, {
        title, author, publisher,
        retail_price: Number(retailPrice),
        low_stock_threshold: Number(lowStockThreshold),
        category: category || undefined,
      });
      toast.success('已更新');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!book) return;
    if (!confirm(`确定删除《${book.title}》?`)) return;
    setSubmitting(true);
    try {
      await api.delete(`/books/${book.id}`);
      toast.success('已删除');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!book} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑图书</DialogTitle>
          <DialogDescription>
            ISBN <code className="font-mono">{book?.isbn}</code> · 当前库存 {book?.stock}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="b-title">书名</Label>
            <Input id="b-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-author">作者</Label>
            <Input id="b-author" value={author} onChange={(e) => setAuthor(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-publisher">出版社</Label>
            <Input id="b-publisher" value={publisher} onChange={(e) => setPublisher(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-price">零售价 (¥)</Label>
            <Input id="b-price" type="number" min="0" step="0.01"
                   value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-threshold">低库存阈值</Label>
            <Input id="b-threshold" type="number" min="0"
                   value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} required />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="b-cat">分类</Label>
            <Input id="b-cat" placeholder="文学 / 计算机 / 哲学 …"
                   value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
            <Trash2 className="size-4" />删除
          </Button>
          <div className="flex-1" />
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={submitting} loading={submitting}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

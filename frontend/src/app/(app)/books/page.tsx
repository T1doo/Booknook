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
      <PageHeader title={t('book.title_page')} description={t('book.desc_page')} />

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
          <Search className="size-4" />{t('common.search')}
        </Button>
      </div>

      {/* 表格 */}
      {loading && !data ? (
        <Skeleton className="h-64" />
      ) : !data || data.total === 0 ? (
        <EmptyState
          icon={PackageX}
          title={t('book.empty_title')}
          description={t('book.empty_desc')}
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">{t('common.id')}</TableHead>
                <TableHead>{t('book.title')}</TableHead>
                <TableHead className="w-36 font-mono">{t('book.isbn')}</TableHead>
                <TableHead className="w-28">{t('book.author')}</TableHead>
                <TableHead className="w-32">{t('book.publisher')}</TableHead>
                <TableHead className="w-24">{t('book.category')}</TableHead>
                <TableHead className="w-24 text-right">{t('book.retail_price')}</TableHead>
                <TableHead className="w-24 text-right">{t('book.stock')}</TableHead>
                <TableHead className="w-24 text-right">{t('common.operations')}</TableHead>
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
                    <Badge variant={b.stock === 0 ? 'destructive' : b.stock <= b.low_stock_threshold ? 'warning' : 'success'} className="tabular">
                      {b.stock}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(b)} title={t('common.edit')} aria-label={t('common.edit')}>
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
  const t = useT();
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
      toast.success(t('common.updated'));
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.update_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!book) return;
    if (!confirm(t('book.delete_confirm', { title: book.title }))) return;
    setSubmitting(true);
    try {
      await api.delete(`/books/${book.id}`);
      toast.success(t('common.deleted'));
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.delete_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!book} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('book.edit_title')}</DialogTitle>
          <DialogDescription>
            {t('book.edit_desc_prefix')} <code className="font-mono">{book?.isbn}</code> · {t('book.edit_desc_suffix')} {book?.stock}
          </DialogDescription>
        </DialogHeader>
        {/* D12: DialogFooter 移到 form 内, 让保存按钮属于 form, 支持回车提交 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="b-title">{t('book.title')}</Label>
              <Input id="b-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-author">{t('book.author')}</Label>
              <Input id="b-author" value={author} onChange={(e) => setAuthor(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-publisher">{t('book.publisher')}</Label>
              <Input id="b-publisher" value={publisher} onChange={(e) => setPublisher(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-price">{t('book.retail_price_yuan')}</Label>
              <Input id="b-price" type="number" min="0" step="0.01"
                     value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-threshold">{t('book.low_threshold')}</Label>
              <Input id="b-threshold" type="number" min="0"
                     value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} required />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="b-cat">{t('book.category')}</Label>
              <Input id="b-cat" placeholder={t('book.category_placeholder')}
                     value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={submitting} aria-label={t('common.delete')}>
              <Trash2 className="size-4" />{t('common.delete')}
            </Button>
            <div className="flex-1" />
            <DialogClose asChild>
              <Button type="button" variant="outline">{t('common.cancel')}</Button>
            </DialogClose>
            <Button type="submit" disabled={submitting} loading={submitting}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

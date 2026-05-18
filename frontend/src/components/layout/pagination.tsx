import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({
  page, pageSize, total, onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
      <span>
        共 <span className="text-foreground font-medium">{total}</span> 条 ·
        第 <span className="text-foreground font-medium">{page}</span> / {totalPages} 页
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="size-4" /> 上一页
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}>
          下一页 <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

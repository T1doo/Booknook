import { type LucideIcon, Inbox } from 'lucide-react';

export function EmptyState({
  icon: Icon = Inbox,
  title = '暂无数据',
  description,
  action,
}: {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="size-16 rounded-full bg-secondary/60 flex items-center justify-center mb-4">
        <Icon className="size-7 text-muted-foreground" strokeWidth={1.4} />
      </div>
      <h3 className="font-serif text-lg font-medium">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

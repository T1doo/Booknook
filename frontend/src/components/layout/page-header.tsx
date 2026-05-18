export function PageHeader({
  title, description, action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1.5">{description}</p>}
      </div>
      {action}
    </header>
  );
}

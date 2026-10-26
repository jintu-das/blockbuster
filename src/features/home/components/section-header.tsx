export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex min-w-0 items-baseline gap-3">
        <h2 className="font-heading text-xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <span className="truncate font-mono text-xs text-muted-foreground">{description}</span>
        )}
      </div>
      {action}
    </div>
  );
}

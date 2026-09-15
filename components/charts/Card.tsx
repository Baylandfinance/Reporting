export function Card({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-grid bg-surface p-5 dark:border-grid-dark dark:bg-surface-dark">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-ink dark:text-ink-dark">{title}</h2>
          {subtitle && (
            <p className="text-xs text-ink-secondary dark:text-ink-secondary-dark">
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

import type { LucideIcon } from "lucide-react";

export function StatTile({
  label,
  value,
  delta,
  deltaDirection = "up",
  icon: Icon,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  icon: LucideIcon;
}) {
  const deltaColor =
    deltaDirection === "up"
      ? "text-status-good"
      : deltaDirection === "down"
        ? "text-status-critical"
        : "text-ink-muted";

  return (
    <div className="rounded-xl border border-grid bg-surface p-4 dark:border-grid-dark dark:bg-surface-dark">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-ink-secondary dark:text-ink-secondary-dark">
          {label}
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-series-1/10 text-series-1">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 text-2xl font-semibold tabular-nums text-ink dark:text-ink-dark">
        {value}
      </div>
      {delta && (
        <div className={`mt-1 text-xs font-medium ${deltaColor}`}>{delta}</div>
      )}
    </div>
  );
}

type Item = { label: string; value: number };

/** Single-measure magnitude across categories — one hue, identity carried by the label. */
export function HorizontalBarList({ data }: { data: Item[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-ink-secondary dark:text-ink-secondary-dark">
              {d.label}
            </span>
            <span className="font-medium tabular-nums text-ink dark:text-ink-dark">
              {d.value}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-grid dark:bg-grid-dark">
            <div
              className="h-2 rounded-full bg-series-3"
              style={{ width: `${Math.max((d.value / max) * 100, 4)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

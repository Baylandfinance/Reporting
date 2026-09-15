type Row = {
  name: string;
  segment: string;
  settled: number;
  revenue: string;
  conversionRate: number;
};

const CURRENCY_FMT = new Intl.NumberFormat("en-AU");

export function RankedTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-muted">
            <th className="pb-2 font-medium">#</th>
            <th className="pb-2 font-medium">Broker</th>
            <th className="pb-2 font-medium text-right">Settled</th>
            <th className="pb-2 font-medium text-right">Revenue</th>
            <th className="pb-2 font-medium text-right">Conversion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-grid dark:divide-grid-dark">
          {rows.map((row, i) => (
            <tr key={row.name}>
              <td className="py-2.5 tabular-nums text-ink-muted">{i + 1}</td>
              <td className="py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-series-1/10 text-[11px] font-semibold text-series-1">
                    {row.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div>
                    <div className="font-medium text-ink dark:text-ink-dark">
                      {row.name}
                    </div>
                    <div className="text-xs text-ink-muted">{row.segment}</div>
                  </div>
                </div>
              </td>
              <td className="py-2.5 text-right tabular-nums">{row.settled}</td>
              <td className="py-2.5 text-right tabular-nums">
                ${CURRENCY_FMT.format(Number(row.revenue))}
              </td>
              <td className="py-2.5 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="h-1.5 w-16 rounded-full bg-grid dark:bg-grid-dark">
                    <div
                      className="h-1.5 rounded-full bg-status-good"
                      style={{ width: `${row.conversionRate}%` }}
                    />
                  </div>
                  <span className="w-9 text-right tabular-nums text-ink-secondary dark:text-ink-secondary-dark">
                    {row.conversionRate}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

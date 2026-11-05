export type ReportRow = {
  label: string;
  cells: (string | number | null)[];
  /** "subtotal" and "total" rows are emphasised; "group" starts a labelled block. */
  kind?: "row" | "subtotal" | "total" | "group";
  indent?: boolean;
};

/**
 * Month-across-the-columns table used by the management reports. Numbers
 * are pre-formatted by the caller; null renders as an en dash, which the
 * specs use for "nothing recorded" (distinct from a real zero).
 */
export function ReportTable({
  headers,
  rows,
  firstColumnLabel,
}: {
  headers: string[];
  rows: ReportRow[];
  firstColumnLabel: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-muted">
            <th className="whitespace-nowrap pb-2 pr-4 font-medium">{firstColumnLabel}</th>
            {headers.map((h) => (
              <th key={h} className="whitespace-nowrap pb-2 pl-3 text-right font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-grid dark:divide-grid-dark">
          {rows.map((row, i) => {
            if (row.kind === "group") {
              return (
                <tr key={i}>
                  <td
                    colSpan={headers.length + 1}
                    className="pb-1.5 pt-4 text-xs font-medium uppercase tracking-wide text-ink-muted"
                  >
                    {row.label}
                  </td>
                </tr>
              );
            }
            const emphasis =
              row.kind === "total"
                ? "font-semibold text-ink dark:text-ink-dark border-t-2 border-ink-muted/40"
                : row.kind === "subtotal"
                  ? "font-medium text-ink dark:text-ink-dark bg-plane dark:bg-plane-dark"
                  : "text-ink-secondary dark:text-ink-secondary-dark";
            return (
              <tr key={i} className={emphasis}>
                <td className={`whitespace-nowrap py-2 pr-4 ${row.indent ? "pl-4" : ""}`}>{row.label}</td>
                {row.cells.map((c, j) => (
                  <td key={j} className="whitespace-nowrap py-2 pl-3 text-right tabular-nums">
                    {c === null ? "–" : c}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

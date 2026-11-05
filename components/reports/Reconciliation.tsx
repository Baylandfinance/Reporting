import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/charts/Card";
import type { ManagementReport } from "@/lib/reports/management";

const COUNT = new Intl.NumberFormat("en-AU");

/** Shown above a report when fewer loans were read than the database holds. */
export function CompletenessBanner({ report }: { report: ManagementReport }) {
  if (report.loansRead === report.totalLoansInDatabase) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-status-critical/40 bg-status-critical/10 p-4 text-sm text-ink dark:text-ink-dark">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-critical" />
      <div>
        <p className="font-medium">These figures may be incomplete.</p>
        <p className="text-ink-secondary dark:text-ink-secondary-dark">
          The database holds {COUNT.format(report.totalLoansInDatabase)} loans but this report read{" "}
          {COUNT.format(report.loansRead)}. This can happen if an upload was running at the same moment.
          Reload the page; if it persists, don&apos;t rely on these numbers.
        </p>
      </div>
    </div>
  );
}

/**
 * "Where every loan went": every loan read lands in exactly one line, so
 * the lines sum to the total and nothing is excluded without being shown.
 */
export function ReconciliationCard({ report }: { report: ManagementReport }) {
  const included = report.reconciliation.filter((l) => l.inReport);
  const excluded = report.reconciliation.filter((l) => !l.inReport);
  const sum = report.reconciliation.reduce((s, l) => s + l.count, 0);

  return (
    <Card
      title="Where every loan went"
      subtitle={`All ${COUNT.format(report.loansRead)} loans on file, each counted once. Leads count in the pipeline only if first recorded from ${report.leadCutoffLabel}.`}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BucketTable heading="Counted in this report" lines={included} />
        <BucketTable heading="Not counted, and why" lines={excluded} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-grid pt-3 text-sm dark:border-grid-dark">
        <span className="text-ink-secondary dark:text-ink-secondary-dark">Total accounted for</span>
        <span className="font-semibold tabular-nums text-ink dark:text-ink-dark">
          {COUNT.format(sum)} of {COUNT.format(report.totalLoansInDatabase)}
        </span>
      </div>

      <h3 className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-ink-muted">How loans were credited to teams</h3>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-grid dark:divide-grid-dark">
          {report.attribution.map((a) => (
            <tr key={a.label}>
              <td className="py-2 text-ink-secondary dark:text-ink-secondary-dark">{a.label}</td>
              <td className="py-2 text-right tabular-nums text-ink dark:text-ink-dark">{COUNT.format(a.count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function BucketTable({ heading, lines }: { heading: string; lines: ManagementReport["reconciliation"] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">{heading}</h3>
      {lines.length === 0 ? (
        <p className="text-sm text-ink-muted">None.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody className="divide-y divide-grid dark:divide-grid-dark">
            {lines.map((l) => (
              <tr key={l.label}>
                <td className="py-2 text-ink-secondary dark:text-ink-secondary-dark">{l.label}</td>
                <td className="py-2 text-right tabular-nums text-ink dark:text-ink-dark">{COUNT.format(l.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

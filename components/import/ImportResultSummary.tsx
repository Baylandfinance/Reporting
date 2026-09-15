"use client";

import { useState } from "react";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import type { SyncResult } from "@/lib/import/syncRows";

/**
 * Renders an import/sync result as a grouped, scannable summary instead of
 * one line per skipped row — a real workbook can skip thousands of rows for
 * a handful of distinct reasons (usually: one broker name not yet set up as
 * a staff account), and a flat bullet list of every row is unreadable past
 * a few dozen entries.
 */
export function ImportResultSummary({ result }: { result: SyncResult }) {
  const [showOther, setShowOther] = useState(false);
  const totalSkipped =
    result.skippedByBroker.reduce((s, b) => s + b.count, 0) + result.errors.length;

  return (
    <div className="rounded-lg border border-grid p-4 text-sm dark:border-grid-dark">
      <div className="mb-3 flex items-center gap-2 font-medium text-ink dark:text-ink-dark">
        {totalSkipped === 0 ? (
          <CheckCircle2 className="h-4 w-4 text-status-good" />
        ) : (
          <TriangleAlert className="h-4 w-4 text-status-warning" />
        )}
        {result.synced} row{result.synced === 1 ? "" : "s"} imported
        {totalSkipped > 0 && `, ${totalSkipped} skipped`}
      </div>

      {result.skippedByBroker.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium text-ink-secondary dark:text-ink-secondary-dark">
            Skipped because the broker name doesn&apos;t match a staff account yet:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-ink-muted">
                  <th className="pb-1.5 font-medium">Broker name in sheet</th>
                  <th className="pb-1.5 pl-4 text-right font-medium">Rows</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grid dark:divide-grid-dark">
                {result.skippedByBroker.map((b) => (
                  <tr key={b.name}>
                    <td className="py-1.5">{b.name || <em>(blank)</em>}</td>
                    <td className="py-1.5 pl-4 text-right font-medium tabular-nums text-ink dark:text-ink-dark">
                      {b.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-xs text-ink-muted">
            Add these under <strong>Users &amp; Access</strong> with a name that matches exactly,
            then re-upload — it&apos;s safe to run again.
          </p>
        </div>
      )}

      {result.errors.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowOther((v) => !v)}
            className="text-xs font-medium text-series-1 hover:underline"
          >
            {showOther ? "Hide" : "Show"} {result.errors.length} other issue
            {result.errors.length === 1 ? "" : "s"}
          </button>
          {showOther && (
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-ink-secondary dark:text-ink-secondary-dark">
              {result.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

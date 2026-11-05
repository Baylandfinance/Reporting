"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import type { MonthRef } from "@/lib/reports/management";

/**
 * Reporting-month picker plus Export PDF. Changing the month re-renders
 * the server page with ?month=YYYY-MM; the spinner covers that round trip.
 * Export uses the browser's own print-to-PDF, with print styles hiding the
 * sidebar and these controls.
 */
export function ReportControls({ months, selected }: { months: MonthRef[]; selected: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs print:hidden">
      <label htmlFor="report-month" className="text-ink-muted">
        Reporting month
      </label>
      <select
        id="report-month"
        value={selected}
        disabled={isPending}
        onChange={(e) => startTransition(() => router.push(`${pathname}?month=${e.target.value}`))}
        className="rounded-lg border border-grid bg-surface px-3 py-1.5 font-medium text-ink disabled:opacity-60 dark:border-grid-dark dark:bg-surface-dark dark:text-ink-dark"
      >
        {months.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label}
          </option>
        ))}
      </select>
      {isPending && (
        <span className="inline-flex items-center gap-1.5 text-ink-muted">
          <Spinner className="h-3.5 w-3.5" />
          Loading…
        </span>
      )}
      <button
        type="button"
        onClick={() => window.print()}
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-grid bg-surface px-3 py-1.5 font-medium text-ink hover:border-series-1 dark:border-grid-dark dark:bg-surface-dark dark:text-ink-dark"
      >
        <Printer className="h-3.5 w-3.5" />
        Export PDF
      </button>
    </div>
  );
}

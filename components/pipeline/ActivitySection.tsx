"use client";

import { useMemo, useState } from "react";
import { CircleCheck, FileCheck2, Filter, MessageCircleQuestion, X } from "lucide-react";
import { StatTile } from "@/components/charts/StatTile";
import { Card } from "@/components/charts/Card";
import { TrendArea } from "@/components/charts/TrendArea";
import type { ActivityRow } from "@/lib/reports/queries";

const ALL = "__all__";

function isInMonth(dateStr: string | null, year: number, month: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() === month;
}

/** Distinct, sorted values for one filter dimension, drawn from the full unfiltered dataset. */
function optionsFor(rows: ActivityRow[], pick: (r: ActivityRow) => string): string[] {
  return Array.from(new Set(rows.map(pick))).sort((a, b) => a.localeCompare(b));
}

export function ActivitySection({ rows }: { rows: ActivityRow[] }) {
  const [broker, setBroker] = useState(ALL);
  const [loanAdministrator, setLoanAdministrator] = useState(ALL);
  const [parabroker, setParabroker] = useState(ALL);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const brokerOptions = useMemo(() => optionsFor(rows, (r) => r.broker), [rows]);
  const loanAdminOptions = useMemo(() => optionsFor(rows, (r) => r.loanAdministrator), [rows]);
  const parabrokerOptions = useMemo(() => optionsFor(rows, (r) => r.parabroker), [rows]);

  const activeFilterCount = [broker, loanAdministrator, parabroker].filter((v) => v !== ALL).length;

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          (broker === ALL || r.broker === broker) &&
          (loanAdministrator === ALL || r.loanAdministrator === loanAdministrator) &&
          (parabroker === ALL || r.parabroker === parabroker)
      ),
    [rows, broker, loanAdministrator, parabroker]
  );

  const activity = useMemo(() => {
    const now = new Date();
    const leadsThisMonth = filteredRows.filter((r) =>
      isInMonth(r.enquiryDate, now.getFullYear(), now.getMonth())
    ).length;
    const submissionsThisMonth = filteredRows.filter((r) =>
      isInMonth(r.submissionDate, now.getFullYear(), now.getMonth())
    ).length;
    const settlementsThisMonth = filteredRows.filter(
      (r) => r.isSettled && isInMonth(r.settlementDate, now.getFullYear(), now.getMonth())
    ).length;

    const leadsMonthly: { label: string; value: number }[] = [];
    const submissionsMonthly: { label: string; value: number }[] = [];
    const settlementValueMonthly: { label: string; value: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString("en-AU", { month: "short" });
      const year = d.getFullYear();
      const month = d.getMonth();

      leadsMonthly.push({
        label,
        value: filteredRows.filter((r) => isInMonth(r.enquiryDate, year, month)).length,
      });
      submissionsMonthly.push({
        label,
        value: filteredRows.filter((r) => isInMonth(r.submissionDate, year, month)).length,
      });
      settlementValueMonthly.push({
        label,
        value: filteredRows.reduce(
          (sum, r) =>
            sum + (r.isSettled && isInMonth(r.settlementDate, year, month) ? r.loanAmount ?? 0 : 0),
          0
        ),
      });
    }

    return { leadsThisMonth, submissionsThisMonth, settlementsThisMonth, leadsMonthly, submissionsMonthly, settlementValueMonthly };
  }, [filteredRows]);

  function clearFilters() {
    setBroker(ALL);
    setLoanAdministrator(ALL);
    setParabroker(ALL);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-grid bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:bg-plane dark:border-grid-dark dark:bg-surface-dark dark:text-ink-dark dark:hover:bg-white/5"
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-series-1 px-1.5 py-0.5 text-xs font-semibold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:underline"
          >
            <X className="h-3 w-3" />
            Clear filters
          </button>
        )}
      </div>

      {filtersOpen && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-grid bg-surface p-4 dark:border-grid-dark dark:bg-surface-dark">
          <FilterSelect label="Broker" value={broker} onChange={setBroker} options={brokerOptions} />
          <FilterSelect
            label="Loan administrator"
            value={loanAdministrator}
            onChange={setLoanAdministrator}
            options={loanAdminOptions}
          />
          <FilterSelect
            label="Parabroker"
            value={parabroker}
            onChange={setParabroker}
            options={parabrokerOptions}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Leads this month" value={String(activity.leadsThisMonth)} icon={MessageCircleQuestion} />
        <StatTile label="Submissions this month" value={String(activity.submissionsThisMonth)} icon={FileCheck2} />
        <StatTile label="Settlements this month" value={String(activity.settlementsThisMonth)} icon={CircleCheck} />
      </div>

      <Card title="Leads / enquiries" subtitle="New enquiries received per month, last 12 months">
        {filteredRows.length === 0 ? (
          <EmptyState />
        ) : (
          <TrendArea data={activity.leadsMonthly} format="count" />
        )}
      </Card>

      <Card title="Submissions" subtitle="Loans submitted per month, last 12 months">
        {filteredRows.length === 0 ? (
          <EmptyState />
        ) : (
          <TrendArea data={activity.submissionsMonthly} format="count" />
        )}
      </Card>

      <Card title="Settlement value" subtitle="Actually settled loan value per month, last 12 months">
        {filteredRows.length === 0 ? (
          <EmptyState />
        ) : (
          <TrendArea data={activity.settlementValueMonthly} format="currency" />
        )}
      </Card>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="min-w-[180px] flex-1">
      <label className="mb-1 block text-xs font-medium text-ink-secondary dark:text-ink-secondary-dark">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-grid bg-surface px-2 py-2 text-sm dark:border-grid-dark dark:bg-surface-dark"
      >
        <option value={ALL}>All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[180px] items-center justify-center text-sm text-ink-muted">
      No loans match these filters.
    </div>
  );
}

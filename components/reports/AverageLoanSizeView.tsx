import { Scale, TrendingDown, TrendingUp, Users2 } from "lucide-react";
import { Card } from "@/components/charts/Card";
import { StatTile } from "@/components/charts/StatTile";
import { MultiLine } from "@/components/charts/MultiLine";
import { ReportTable, type ReportRow } from "@/components/reports/ReportTable";
import { CompletenessBanner, ReconciliationCard } from "@/components/reports/Reconciliation";
import { COLUMN_ORDER, averageOf, type ColumnKey, type ManagementReport, type ValueCount } from "@/lib/reports/management";
import { STAGE_LABELS, STAGE_ORDER, TEAM_LABELS } from "@/lib/reports/management-config";

const COLUMN_LABEL: Record<ColumnKey, string> = { ...TEAM_LABELS, Company: "Company" };

/** $'000, whole numbers; "–" when nothing with an amount exists. */
const k = (v: number | null) => (v == null ? null : Math.round(v / 1000).toLocaleString("en-AU"));
const avgK = (vc: ValueCount) => k(averageOf(vc));

export function AverageLoanSizeView({ report }: { report: ManagementReport }) {
  const c = report.columns;
  const co = c.Company;
  const last = report.months.length - 1;
  const thisMonth = averageOf(co.monthly[last]!.settled);
  const prevMonth = last > 0 ? averageOf(co.monthly[last - 1]!.settled) : null;
  const change = thisMonth != null && prevMonth != null ? thisMonth - prevMonth : null;

  const monthlyRows: ReportRow[] = COLUMN_ORDER.flatMap((key): ReportRow[] => {
    const f = c[key];
    return [
      { label: COLUMN_LABEL[key], cells: [], kind: "group" },
      {
        label: "Loans settled",
        indent: true,
        cells: [...f.monthly.map((mo) => (mo.settled.count ? mo.settled.count : null)), f.settledYtd.count || null],
      },
      {
        label: "Value settled",
        indent: true,
        cells: [...f.monthly.map((mo) => (mo.settled.count ? k(mo.settled.value) : null)), f.settledYtd.count ? k(f.settledYtd.value) : null],
      },
      {
        label: "Average loan size",
        kind: key === "Company" ? "total" : "subtotal",
        cells: [...f.monthly.map((mo) => avgK(mo.settled)), avgK(f.settledYtd)],
      },
    ];
  });

  const missingAmounts = co.settledYtd.count - co.settledYtd.countWithAmount;

  return (
    <>
      <CompletenessBanner report={report} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Company average – this FY"
          value={co.settledYtd.countWithAmount ? `$${avgK(co.settledYtd)}k` : "–"}
          delta={`${co.settledYtd.count} loans settled`}
          deltaDirection="neutral"
          icon={Scale}
        />
        <StatTile
          label={`Company average – ${report.months[last]!.label}`}
          value={thisMonth != null ? `$${k(thisMonth)}k` : "–"}
          delta={
            change == null
              ? "No prior month to compare"
              : `${change >= 0 ? "+" : "−"}$${k(Math.abs(change))}k (${change >= 0 ? "+" : "−"}${Math.abs((change / prevMonth!) * 100).toFixed(1)}%) on prior month`
          }
          deltaDirection={change == null ? "neutral" : change >= 0 ? "up" : "down"}
          icon={change != null && change < 0 ? TrendingDown : TrendingUp}
        />
        <StatTile
          label="Team S average – this FY"
          value={c.S.settledYtd.countWithAmount ? `$${avgK(c.S.settledYtd)}k` : "–"}
          delta={`${c.S.settledYtd.count} loans`}
          deltaDirection="neutral"
          icon={Users2}
        />
        <StatTile
          label="Team B average – this FY"
          value={c.B.settledYtd.countWithAmount ? `$${avgK(c.B.settledYtd)}k` : "–"}
          delta={`${c.B.settledYtd.count} loans`}
          deltaDirection="neutral"
          icon={Users2}
        />
      </div>

      {missingAmounts > 0 && (
        <p className="text-xs text-ink-secondary dark:text-ink-secondary-dark">
          {missingAmounts} settled {missingAmounts === 1 ? "loan has" : "loans have"} no loan amount in the spreadsheet.{" "}
          {missingAmounts === 1 ? "It is" : "They are"} included in loan counts but left out of averages, so {missingAmounts === 1 ? "it doesn't" : "they don't"} drag them down.
        </p>
      )}

      <Card
        title={`1. Average settled loan size by month ($'000) – ${report.financialYearLabel}`}
        subtitle="Full-year average = total value ÷ total loans, not an average of the monthly averages. “–” means no settlements."
      >
        <ReportTable firstColumnLabel="Team" headers={[...report.months.map((mo) => mo.label), "FY to date"]} rows={monthlyRows} />
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="2. Average loan size by pipeline stage ($'000)" subtitle="Is upcoming work bigger or smaller than recent settlements?">
          <ReportTable
            firstColumnLabel="Stage"
            headers={COLUMN_ORDER.map((key) => COLUMN_LABEL[key])}
            rows={[
              { label: "Settled this FY", kind: "subtotal", cells: COLUMN_ORDER.map((key) => avgK(c[key].settledYtd)) },
              ...STAGE_ORDER.map((s) => ({ label: STAGE_LABELS[s], cells: COLUMN_ORDER.map((key) => avgK(c[key].stages[s])) })),
            ]}
          />
        </Card>

        <Card title="3. Average settled loan size trend ($'000)" subtitle="Dashed line: company average for the financial year">
          <MultiLine
            format="thousands"
            reference={averageOf(co.settledYtd) != null ? { value: averageOf(co.settledYtd)! / 1000, label: `Company FY $${avgK(co.settledYtd)}k` } : undefined}
            data={report.months.map((mo, i) => ({
              label: mo.label,
              ...Object.fromEntries(
                COLUMN_ORDER.map((key) => {
                  const avg = averageOf(c[key].monthly[i]!.settled);
                  return [key, avg == null ? null : avg / 1000];
                })
              ),
            }))}
            series={COLUMN_ORDER.map((key) => ({ key, label: COLUMN_LABEL[key] }))}
          />
        </Card>
      </div>

      <ReconciliationCard report={report} />
    </>
  );
}

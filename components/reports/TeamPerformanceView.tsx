import { CircleCheck, Layers, Target, TrendingUp } from "lucide-react";
import { Card } from "@/components/charts/Card";
import { StatTile } from "@/components/charts/StatTile";
import { MultiLine } from "@/components/charts/MultiLine";
import { ReportTable, type ReportRow } from "@/components/reports/ReportTable";
import { CompletenessBanner, ReconciliationCard } from "@/components/reports/Reconciliation";
import { COLUMN_ORDER, type ColumnKey, type ManagementReport } from "@/lib/reports/management";
import { STAGE_LABELS, STAGE_ORDER, STAGE_WEIGHTING, TEAM_LABELS, TEAM_ORDER } from "@/lib/reports/management-config";

const COLUMN_LABEL: Record<ColumnKey, string> = { ...TEAM_LABELS, Company: "Company" };

const m = (v: number) => (v / 1_000_000).toFixed(2);
const pct = (v: number | null) => (v == null ? null : `${(v * 100).toFixed(1)}%`);
const signedM = (v: number) => (v >= 0 ? `+${m(v)}` : `−${m(Math.abs(v))}`);
const weight = (w: number) => `${(w * 100).toFixed(w === 0.315 ? 1 : 0)}%`;

export function TeamPerformanceView({ report }: { report: ManagementReport }) {
  const c = report.columns;
  const co = c.Company;
  const ratio = (num: number, den: number | null) => (den ? num / den : null);

  const summaryRow = (label: string, cell: (k: ColumnKey) => string | number | null, kind?: ReportRow["kind"]): ReportRow => ({
    label,
    cells: COLUMN_ORDER.map(cell),
    kind,
  });

  const stageTable = (mode: "value" | "count"): ReportRow[] => {
    const fmt = (v: number) => (mode === "value" ? m(v) : String(v));
    const fmtW = (v: number) => (mode === "value" ? m(v) : v.toFixed(1));
    const pick = (vc: { value: number; count: number }) => (mode === "value" ? vc.value : vc.count);
    const rows: ReportRow[] = [
      {
        label: "Settled (this financial year)",
        cells: ["100%", ...COLUMN_ORDER.flatMap((k) => [fmt(pick(c[k].settledYtd)), fmtW(pick(c[k].settledYtd))])],
      },
      ...STAGE_ORDER.map((s) => ({
        label: STAGE_LABELS[s],
        cells: [
          weight(STAGE_WEIGHTING[s]),
          ...COLUMN_ORDER.flatMap((k) => [fmt(pick(c[k].stages[s])), fmtW(pick(c[k].stages[s]) * STAGE_WEIGHTING[s])]),
        ],
      })),
      {
        label: "Total",
        kind: "total",
        cells: [
          "",
          ...COLUMN_ORDER.flatMap((k) => {
            const gross = pick(c[k].settledYtd) + STAGE_ORDER.reduce((s, st) => s + pick(c[k].stages[st]), 0);
            const forecast = mode === "value" ? c[k].forecastValue : c[k].forecastCount;
            return [fmt(gross), fmtW(forecast)];
          }),
        ],
      },
    ];
    if (mode === "count") {
      rows.push({
        label: "Submissions this financial year",
        cells: ["", ...COLUMN_ORDER.flatMap((k) => [c[k].monthly.reduce((s, mo) => s + mo.submissions, 0), null])],
      });
    }
    return rows;
  };

  const stageHeaders = (unit: "gross" | "count") => ["Weighting", ...COLUMN_ORDER.flatMap((k) => [`${COLUMN_LABEL[k]} ${unit}`, "weighted"])];

  const teamGoalPerMonth = (co.annualGoal ?? 0) / 12;
  const cumulativeData = report.months.map((mo, i) => ({
    label: mo.label,
    settled: co.monthly.slice(0, i + 1).reduce((s, x) => s + x.settled.value, 0) / 1e6,
    goal: (teamGoalPerMonth * (i + 1)) / 1e6,
  }));

  const activityRows: ReportRow[] = [
    {
      label: "New leads received – company",
      cells: [...co.monthly.map((mo) => mo.newLeads), co.monthly.reduce((s, mo) => s + mo.newLeads, 0)],
    },
  ];
  const activityGroup = (heading: string, value: (mo: ManagementReport["columns"]["S"]["monthly"][number]) => number, fmt: (v: number) => string | number) => {
    activityRows.push({ label: heading, cells: [], kind: "group" });
    for (const k of COLUMN_ORDER) {
      const vals = c[k].monthly.map(value);
      activityRows.push({
        label: COLUMN_LABEL[k],
        indent: k !== "Company",
        kind: k === "Company" ? "subtotal" : undefined,
        cells: [...vals.map(fmt), fmt(vals.reduce((s, v) => s + v, 0))],
      });
    }
  };
  activityGroup("Submissions lodged", (mo) => mo.submissions, (v) => v);
  activityGroup("Loans settled", (mo) => mo.settled.count, (v) => v);
  activityGroup("Settled value ($m)", (mo) => mo.settled.value, m);

  const teamsSettled = TEAM_ORDER.filter((t) => c[t].annualGoal != null).reduce((s, t) => s + c[t].settledYtd.value, 0);

  return (
    <>
      <CompletenessBanner report={report} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Settled this FY – company"
          value={`$${m(co.settledYtd.value)}m`}
          delta={`Teams: ${pct(ratio(teamsSettled, co.ytdGoal))} of $${m(co.ytdGoal ?? 0)}m YTD goal`}
          deltaDirection={teamsSettled >= (co.ytdGoal ?? 0) ? "up" : "down"}
          icon={CircleCheck}
        />
        <StatTile
          label="Loans settled this FY"
          value={String(co.settledYtd.count)}
          delta={TEAM_ORDER.map((t) => `${TEAM_LABELS[t]} ${c[t].settledYtd.count}`).join(" · ")}
          deltaDirection="neutral"
          icon={Layers}
        />
        <StatTile label="Weighted pipeline" value={`$${m(co.weightedPipelineValue)}m`} delta="Not yet settled" deltaDirection="neutral" icon={TrendingUp} />
        <StatTile
          label="Forecast – full year"
          value={`$${m(co.forecastValue)}m`}
          delta={`${pct(ratio(co.forecastValue, co.annualGoal))} of $${m(co.annualGoal ?? 0)}m goal`}
          deltaDirection={co.forecastValue >= (co.annualGoal ?? 0) ? "up" : "down"}
          icon={Target}
        />
      </div>

      <Card
        title="1. Performance summary ($m)"
        subtitle={`Goal, actuals and forecast by team. ${report.financialYearLabel}, month ${report.monthsElapsed} of 12. Company includes David's own deals; the $120m goal is the two teams'.`}
      >
        <ReportTable
          firstColumnLabel="Measure"
          headers={COLUMN_ORDER.map((k) => COLUMN_LABEL[k])}
          rows={[
            summaryRow("Annual goal (12 months)", (k) => (c[k].annualGoal == null ? null : m(c[k].annualGoal!))),
            summaryRow(`YTD goal (${report.monthsElapsed} of 12 months)`, (k) => (c[k].ytdGoal == null ? null : m(c[k].ytdGoal!))),
            summaryRow("Settled this FY", (k) => m(c[k].settledYtd.value), "subtotal"),
            summaryRow("Number of loans settled", (k) => c[k].settledYtd.count),
            summaryRow("Settled as % of YTD goal", (k) => pct(ratio(c[k].settledYtd.value, c[k].ytdGoal))),
            summaryRow("Settled as % of annual goal", (k) => pct(ratio(c[k].settledYtd.value, c[k].annualGoal))),
            summaryRow("Weighted pipeline (not yet settled)", (k) => m(c[k].weightedPipelineValue)),
            summaryRow("Forecast settlements (12 months)", (k) => m(c[k].forecastValue), "subtotal"),
            summaryRow("Forecast number of settlements", (k) => c[k].forecastCount.toFixed(1)),
            summaryRow("Forecast as % of annual goal", (k) => pct(ratio(c[k].forecastValue, c[k].annualGoal))),
            summaryRow(
              "Forecast vs annual goal",
              (k) => (c[k].annualGoal == null ? null : signedM(c[k].forecastValue - c[k].annualGoal!)),
              "total"
            ),
          ]}
        />
      </Card>

      <Card
        title="2. Pipeline by stage ($m)"
        subtitle="Gross amount × weighting = weighted amount. Pipeline uses each loan's current status in the latest upload."
      >
        <ReportTable firstColumnLabel="Stage" headers={stageHeaders("gross")} rows={stageTable("value")} />
      </Card>

      <Card title="3. Pipeline by stage (number of loans)" subtitle="Same stages and weightings, counted in loans">
        <ReportTable firstColumnLabel="Stage" headers={stageHeaders("count")} rows={stageTable("count")} />
      </Card>

      <Card
        title="Conversion rates used in the weightings"
        subtitle="Starting assumptions from the specification. Actual rates need month-end snapshots, which start being recorded once this is live."
      >
        <ReportTable
          firstColumnLabel="Conversion step"
          headers={["Starting rate", "Actual this month", "Applied rate"]}
          rows={[
            { label: "Lead → planned submission", cells: ["50%", null, "50%"] },
            { label: "Planned submission → submitted", cells: ["90%", null, "90%"] },
            { label: "Submitted → approved", cells: ["70%", null, "70%"] },
            { label: "Approved → settled", cells: ["100%", null, "100%"] },
          ]}
        />
      </Card>

      <Card title="Cumulative settled vs YTD goal – company ($m)" subtitle="Goal phased evenly across the 12 months">
        <MultiLine
          format="millions"
          data={cumulativeData}
          series={[
            { key: "settled", label: "Cumulative settled" },
            { key: "goal", label: "Cumulative goal" },
          ]}
        />
      </Card>

      <Card title="4. Activity by month" subtitle="By date recorded in the spreadsheet: enquiry, submission and settlement dates">
        <ReportTable firstColumnLabel="Measure" headers={[...report.months.map((mo) => mo.label), "FY total"]} rows={activityRows} />
      </Card>

      <ReconciliationCard report={report} />
    </>
  );
}

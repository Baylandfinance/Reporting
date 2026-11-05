import { CircleCheck, Target, TrendingUp, Layers } from "lucide-react";
import { Topbar } from "@/components/nav/Topbar";
import { Card } from "@/components/charts/Card";
import { StatTile } from "@/components/charts/StatTile";
import { MultiLine } from "@/components/charts/MultiLine";
import { ReportTable } from "@/components/reports/ReportTable";

// PREVIEW ONLY — dummy data copied from "Broker Team Performance Report – Specification".

const m = (v: number) => v.toFixed(2);
const pct = (v: number) => `${v.toFixed(1)}%`;
const signed = (v: number) => (v >= 0 ? `+${v.toFixed(2)}` : `−${Math.abs(v).toFixed(2)}`);

const MONTHS = ["Jul-26", "Aug-26", "Sep-26", "Oct-26"];

export default function TeamPerformancePreview() {
  return (
    <>
      <Topbar
        title="Team Performance"
        subtitle="Year-to-date settlements and weighted pipeline against the $60m per team goal. FY 1 Jul 2026 – 30 Jun 2027, month 4 of 12."
      />
      <main className="flex-1 space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-ink-muted">Reporting month</span>
          <span className="rounded-lg border border-grid bg-surface px-3 py-1.5 font-medium text-ink">October 2026 ▾</span>
          <span className="ml-auto rounded-lg border border-grid bg-surface px-3 py-1.5 font-medium text-ink">Export PDF</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Settled YTD – company" value="$25.90m" delta="64.8% of $40m YTD goal" deltaDirection="down" icon={CircleCheck} />
          <StatTile label="Loans settled YTD" value="28" delta="Team S 11 · Team B 17" deltaDirection="neutral" icon={Layers} />
          <StatTile label="Weighted pipeline" value="$79.55m" delta="Not yet settled" deltaDirection="neutral" icon={TrendingUp} />
          <StatTile label="Forecast – 12 months" value="$105.45m" delta="87.9% of $120m goal · −$14.55m" deltaDirection="down" icon={Target} />
        </div>

        <Card title="1. Performance summary ($m)" subtitle="Goal, YTD actuals and forecast by team">
          <ReportTable
            firstColumnLabel="Measure"
            headers={["Team S", "Team B", "Company"]}
            rows={[
              { label: "Annual goal (12 months)", cells: [m(60), m(60), m(120)] },
              { label: "YTD goal (4 of 12 months)", cells: [m(20), m(20), m(40)] },
              { label: "Settled YTD", cells: [m(13.7), m(12.2), m(25.9)], kind: "subtotal" },
              { label: "Number of loans settled YTD", cells: [11, 17, 28] },
              { label: "Settled as % of YTD goal", cells: [pct(68.5), pct(61.0), pct(64.8)] },
              { label: "Settled as % of annual goal", cells: [pct(22.8), pct(20.3), pct(21.6)] },
              { label: "Weighted pipeline (not yet settled)", cells: [m(28.73), m(50.82), m(79.55)] },
              { label: "Forecast settlements (12 months)", cells: [m(42.43), m(63.02), m(105.45)], kind: "subtotal" },
              { label: "Forecast number of settlements", cells: ["45.6", "69.0", "114.6"] },
              { label: "Forecast as % of annual goal", cells: [pct(70.7), pct(105.0), pct(87.9)] },
              { label: "Forecast vs annual goal", cells: [signed(-17.57), signed(3.02), signed(-14.55)], kind: "total" },
            ]}
          />
        </Card>

        <div className="grid grid-cols-1 gap-6">
          <Card title="2. Pipeline by stage ($m)" subtitle="Gross amount × weighting = weighted amount">
            <ReportTable
              firstColumnLabel="Stage"
              headers={["Weighting", "Team S gross", "Team S weighted", "Team B gross", "Team B weighted", "Company gross", "Company weighted"]}
              rows={[
                { label: "Settled", cells: ["100%", m(13.7), m(13.7), m(12.2), m(12.2), m(25.9), m(25.9)] },
                { label: "Approved to be settled", cells: ["100%", m(6.1), m(6.1), m(10), m(10), m(16.1), m(16.1)] },
                { label: "Submitted for approval", cells: ["70%", m(14.5), m(10.15), m(21.5), m(15.05), m(36), m(25.2)] },
                { label: "Planned submissions", cells: ["63%", m(7.3), m(4.6), m(30.9), m(19.47), m(38.2), m(24.07)] },
                { label: "Leads (incl. planned solutions)", cells: ["31.5%", m(25), m(7.88), m(20), m(6.3), m(45), m(14.18)] },
                { label: "Total", cells: ["", m(66.6), m(42.43), m(94.6), m(63.02), m(161.2), m(105.45)], kind: "total" },
              ]}
            />
          </Card>

          <Card title="3. Pipeline by stage (number of loans)" subtitle="Same stages and weightings, counted in loans">
            <ReportTable
              firstColumnLabel="Stage"
              headers={["Weighting", "Team S count", "Team S weighted", "Team B count", "Team B weighted", "Company count", "Company weighted"]}
              rows={[
                { label: "Settled", cells: ["100%", 11, "11.0", 17, "17.0", 28, "28.0"] },
                { label: "Approved to be settled", cells: ["100%", 9, "9.0", 13, "13.0", 22, "22.0"] },
                { label: "Submitted – awaiting approval", cells: ["70%", 14, "9.8", 21, "14.7", 35, "24.5"] },
                { label: "Planned submissions", cells: ["63%", 16, "10.1", 25, "15.8", 41, "25.9"] },
                { label: "Leads (incl. planned solutions)", cells: ["31.5%", 18, "5.7", 27, "8.5", 45, "14.2"] },
                { label: "Total", cells: ["", 68, "45.6", 103, "69.0", 171, "114.6"], kind: "total" },
                { label: "Submissions YTD (cumulative)", cells: ["", 34, null, 50, null, 84, null] },
              ]}
            />
          </Card>
        </div>

        <Card
          title="Conversion rates used in the weightings"
          subtitle="Starting assumptions until 3 months of actuals exist; then the 3-month moving average of actual results"
        >
          <ReportTable
            firstColumnLabel="Conversion step"
            headers={["Starting rate", "Actual – Oct", "Applied rate"]}
            rows={[
              { label: "Lead → planned submission", cells: ["50%", null, "50%"] },
              { label: "Planned submission → submitted", cells: ["90%", null, "90%"] },
              { label: "Submitted → approved", cells: ["70%", null, "70%"] },
              { label: "Approved → settled", cells: ["100%", null, "100%"] },
            ]}
          />
          <p className="mt-3 text-xs text-ink-muted">
            Actual rates show once real data is connected. The specification gives no dummy actuals.
          </p>
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card title="4. Pipeline at month end – company" subtitle="Number of loans at each stage. Rising counts flag work building up.">
            <MultiLine
              data={[
                { label: "Jul-26", leads: 44, planned: 30, submitted: 25, approved: 12 },
                { label: "Aug-26", leads: 46, planned: 34, submitted: 28, approved: 15 },
                { label: "Sep-26", leads: 45, planned: 38, submitted: 32, approved: 19 },
                { label: "Oct-26", leads: 45, planned: 41, submitted: 35, approved: 22 },
              ]}
              series={[
                { key: "leads", label: "Leads" },
                { key: "planned", label: "Planned submissions" },
                { key: "submitted", label: "Submitted" },
                { key: "approved", label: "Approved" },
              ]}
            />
          </Card>
          <Card title="Cumulative settled vs YTD goal – company ($m)" subtitle="Goal phased evenly at $10m a month">
            <MultiLine
              format="millions"
              data={[
                { label: "Jul-26", settled: 4.6, goal: 10 },
                { label: "Aug-26", settled: 10.4, goal: 20 },
                { label: "Sep-26", settled: 17.4, goal: 30 },
                { label: "Oct-26", settled: 25.9, goal: 40 },
              ]}
              series={[
                { key: "settled", label: "Cumulative settled" },
                { key: "goal", label: "Cumulative YTD goal" },
              ]}
            />
          </Card>
        </div>

        <Card title="Activity in the month" subtitle="Settled values in $m">
          <ReportTable
            firstColumnLabel="Measure"
            headers={[...MONTHS, "YTD"]}
            rows={[
              { label: "New leads received – company", cells: [45, 45, 45, 45, 180] },
              { label: "Submissions", cells: [], kind: "group" },
              { label: "Team S", cells: [7, 8, 9, 10, 34], indent: true },
              { label: "Team B", cells: [11, 12, 13, 14, 50], indent: true },
              { label: "Company", cells: [18, 20, 22, 24, 84], kind: "subtotal" },
              { label: "Loans settled", cells: [], kind: "group" },
              { label: "Team S", cells: [2, 3, 3, 3, 11], indent: true },
              { label: "Team B", cells: [3, 4, 5, 5, 17], indent: true },
              { label: "Company", cells: [5, 7, 8, 8, 28], kind: "subtotal" },
              { label: "Settled value ($m)", cells: [], kind: "group" },
              { label: "Team S", cells: ["2.40", "3.00", "3.80", "4.50", "13.70"], indent: true },
              { label: "Team B", cells: ["2.20", "2.80", "3.20", "4.00", "12.20"], indent: true },
              { label: "Company", cells: ["4.60", "5.80", "7.00", "8.50", "25.90"], kind: "subtotal" },
            ]}
          />
        </Card>
      </main>
    </>
  );
}

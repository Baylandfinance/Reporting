import { Scale, TrendingUp, Users2 } from "lucide-react";
import { Topbar } from "@/components/nav/Topbar";
import { Card } from "@/components/charts/Card";
import { StatTile } from "@/components/charts/StatTile";
import { MultiLine } from "@/components/charts/MultiLine";
import { ReportTable } from "@/components/reports/ReportTable";

// PREVIEW ONLY — dummy data copied from "Average Loan Size Report – Specification".

const k = (v: number) => Math.round(v).toLocaleString("en-AU");

export default function AverageLoanSizePreview() {
  return (
    <>
      <Topbar
        title="Average Loan Size"
        subtitle="Average settled loan by month and YTD, and average loan at each pipeline stage. $'000."
      />
      <main className="flex-1 space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-ink-muted">Reporting month</span>
          <span className="rounded-lg border border-grid bg-surface px-3 py-1.5 font-medium text-ink">October 2026 ▾</span>
          <span className="ml-auto rounded-lg border border-grid bg-surface px-3 py-1.5 font-medium text-ink">Export PDF</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Company average – YTD" value="$925k" delta="28 loans · $25.90m" deltaDirection="neutral" icon={Scale} />
          <StatTile label="Company average – October" value="$1,063k" delta="+$188k (+21.5%) on September" deltaDirection="up" icon={TrendingUp} />
          <StatTile label="Team S average – YTD" value="$1,245k" delta="11 loans" deltaDirection="neutral" icon={Users2} />
          <StatTile label="Team B average – YTD" value="$718k" delta="17 loans" deltaDirection="neutral" icon={Users2} />
        </div>

        <Card
          title="1. Average settled loan size by month ($'000)"
          subtitle="YTD average = YTD value ÷ YTD loans, not an average of the monthly averages"
        >
          <ReportTable
            firstColumnLabel="Team"
            headers={["Jul-26", "Aug-26", "Sep-26", "Oct-26", "YTD"]}
            rows={[
              { label: "Team S", cells: [], kind: "group" },
              { label: "Loans settled", cells: [2, 3, 3, 3, 11], indent: true },
              { label: "Value settled", cells: [k(2400), k(3000), k(3800), k(4500), k(13700)], indent: true },
              { label: "Average loan size", cells: [k(1200), k(1000), k(1267), k(1500), k(1245)], kind: "subtotal" },
              { label: "Team B", cells: [], kind: "group" },
              { label: "Loans settled", cells: [3, 4, 5, 5, 17], indent: true },
              { label: "Value settled", cells: [k(2200), k(2800), k(3200), k(4000), k(12200)], indent: true },
              { label: "Average loan size", cells: [k(733), k(700), k(640), k(800), k(718)], kind: "subtotal" },
              { label: "Company", cells: [], kind: "group" },
              { label: "Loans settled", cells: [5, 7, 8, 8, 28], indent: true },
              { label: "Value settled", cells: [k(4600), k(5800), k(7000), k(8500), k(25900)], indent: true },
              { label: "Average loan size", cells: [k(920), k(829), k(875), k(1063), k(925)], kind: "total" },
            ]}
          />
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card
            title="2. Average loan size by pipeline stage at 31 Oct ($'000)"
            subtitle="Is upcoming work bigger or smaller than recent settlements?"
          >
            <ReportTable
              firstColumnLabel="Stage"
              headers={["Team S", "Team B", "Company"]}
              rows={[
                { label: "Settled YTD", cells: [k(1245), k(718), k(925)], kind: "subtotal" },
                { label: "Approved to be settled", cells: [k(678), k(769), k(732)] },
                { label: "Submitted – awaiting approval", cells: [k(1036), k(1024), k(1029)] },
                { label: "Planned submissions", cells: [k(456), k(1236), k(932)] },
                { label: "Leads (incl. planned solutions)", cells: [k(1389), k(741), k(1000)] },
              ]}
            />
          </Card>
          <Card title="3. Average settled loan size trend ($'000)" subtitle="Dashed line: company YTD average">
            <MultiLine
              format="thousands"
              reference={{ value: 925, label: "Company YTD $925k" }}
              data={[
                { label: "Jul-26", s: 1200, b: 733, co: 920 },
                { label: "Aug-26", s: 1000, b: 700, co: 829 },
                { label: "Sep-26", s: 1267, b: 640, co: 875 },
                { label: "Oct-26", s: 1500, b: 800, co: 1063 },
              ]}
              series={[
                { key: "s", label: "Team S" },
                { key: "b", label: "Team B" },
                { key: "co", label: "Company" },
              ]}
            />
          </Card>

        </div>
      </main>
    </>
  );
}

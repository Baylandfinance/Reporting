import { CircleCheck, Clock, GitBranch, XCircle } from "lucide-react";
import { requireSessionProfile } from "@/lib/auth/session";
import { Topbar } from "@/components/nav/Topbar";
import { StatTile } from "@/components/charts/StatTile";
import { Card } from "@/components/charts/Card";
import { DonutBreakdown } from "@/components/charts/DonutBreakdown";
import { ActivitySection } from "@/components/pipeline/ActivitySection";
import { getPipelineAndActivity, getPendingSettlements } from "@/lib/reports/queries";

const CURRENCY = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

const DATE = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" });

export default async function PipelinePage() {
  const profile = await requireSessionProfile();
  const [data, pendingSettlements] = await Promise.all([
    getPipelineAndActivity(profile),
    getPendingSettlements(profile),
  ]);

  const now = new Date();
  const totalBookedAmount = pendingSettlements.reduce((sum, r) => sum + (r.loanAmount ?? 0), 0);
  const totalBookedThisMonth = pendingSettlements.reduce((sum, r) => {
    if (!r.settlementBookedDate) return sum;
    const d = new Date(r.settlementBookedDate);
    const inThisMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    return inThisMonth ? sum + (r.loanAmount ?? 0) : sum;
  }, 0);

  return (
    <>
      <Topbar
        title="Pipeline & Settlements"
        subtitle="Loans by stage, and monthly trend across the funnel."
      />
      <main className="flex-1 space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Loans in flight" value={String(Math.max(data.inFlightCount, 0))} icon={GitBranch} />
          <StatTile label="Settled" value={String(data.settledCount)} icon={CircleCheck} />
          <StatTile label="Lost" value={String(data.lostCount)} icon={XCircle} />
          <StatTile label="Conversion rate" value={`${data.conversionRate}%`} icon={Clock} />
        </div>

        <ActivitySection rows={data.activityRows} />

        <Card
          title="Pending settlements"
          subtitle="Approved in the last 12 months, booked to settle in the future — sorted by booked settlement date"
        >
          {pendingSettlements.length === 0 ? (
            <div className="flex h-[120px] items-center justify-center text-sm text-ink-muted">
              Nothing unconditionally approved is waiting on settlement right now.
            </div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <StatTile
                  label="Total booked settlement amount"
                  value={CURRENCY.format(totalBookedAmount)}
                  icon={CircleCheck}
                />
                <StatTile
                  label="Booked settlements this month"
                  value={CURRENCY.format(totalBookedThisMonth)}
                  icon={Clock}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ink-muted">
                      <th className="pb-2 font-medium">Client</th>
                      <th className="pb-2 font-medium">Lender</th>
                      <th className="pb-2 font-medium text-right">Amount</th>
                      <th className="pb-2 font-medium">Unconditional approval</th>
                      <th className="pb-2 font-medium">Booked settlement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grid dark:divide-grid-dark">
                    {pendingSettlements.map((row, i) => (
                      <tr key={i}>
                        <td className="py-2.5 text-ink dark:text-ink-dark">{row.clientName}</td>
                        <td className="py-2.5 text-ink-secondary dark:text-ink-secondary-dark">
                          {row.lenderName}
                        </td>
                        <td className="py-2.5 text-right font-medium tabular-nums text-ink dark:text-ink-dark">
                          {row.loanAmount != null ? CURRENCY.format(row.loanAmount) : "—"}
                        </td>
                        <td className="py-2.5 text-ink-secondary dark:text-ink-secondary-dark">
                          {row.unconditionalApprovalDate
                            ? DATE.format(new Date(row.unconditionalApprovalDate))
                            : "—"}
                        </td>
                        <td className="py-2.5 text-ink-secondary dark:text-ink-secondary-dark">
                          {row.settlementBookedDate
                            ? DATE.format(new Date(row.settlementBookedDate))
                            : <span className="italic text-ink-muted">Not booked</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        <Card title="Stage breakdown" subtitle="Every loan currently on file">
          {data.stageBreakdown.length === 0 ? (
            <EmptyState />
          ) : (
            <DonutBreakdown data={data.stageBreakdown} centerLabel="Loans" />
          )}
        </Card>
      </main>
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[180px] items-center justify-center text-sm text-ink-muted">
      No loans recorded yet — connect Excel Online or add loans to see this report.
    </div>
  );
}

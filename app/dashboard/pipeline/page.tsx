import { CircleCheck, Clock, FileCheck2, GitBranch, XCircle } from "lucide-react";
import { requireSessionProfile } from "@/lib/auth/session";
import { Topbar } from "@/components/nav/Topbar";
import { StatTile } from "@/components/charts/StatTile";
import { Card } from "@/components/charts/Card";
import { TrendArea } from "@/components/charts/TrendArea";
import { DonutBreakdown } from "@/components/charts/DonutBreakdown";
import { ComparisonBars } from "@/components/charts/ComparisonBars";
import { getPipelineOverview, getSubmissionsAndSettlements } from "@/lib/reports/queries";

const CURRENCY = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
  notation: "compact",
});

export default async function PipelinePage() {
  const profile = await requireSessionProfile();
  const [pipeline, submissionsAndSettlements] = await Promise.all([
    getPipelineOverview(profile),
    getSubmissionsAndSettlements(profile),
  ]);

  return (
    <>
      <Topbar
        title="Pipeline & Settlements"
        subtitle="Loans by stage and settlement trend."
      />
      <main className="flex-1 space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Loans in flight" value={String(Math.max(pipeline.inFlightCount, 0))} icon={GitBranch} />
          <StatTile label="Settled" value={String(pipeline.settledCount)} icon={CircleCheck} />
          <StatTile label="Lost" value={String(pipeline.lostCount)} icon={XCircle} />
          <StatTile label="Conversion rate" value={`${pipeline.conversionRate}%`} icon={Clock} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatTile
            label="Submissions this month"
            value={String(submissionsAndSettlements.submissionsThisMonth)}
            icon={FileCheck2}
          />
          <StatTile
            label="Settlements this month"
            value={String(submissionsAndSettlements.settlementsThisMonth)}
            icon={CircleCheck}
          />
        </div>

        <Card
          title="Submissions vs settlements"
          subtitle="Monthly loan count, last 12 months — settlements count a loan once whether it's booked or actually settled that month"
        >
          {pipeline.totalLoans === 0 ? (
            <EmptyState />
          ) : (
            <ComparisonBars data={submissionsAndSettlements.monthly} />
          )}
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card title="Settlement value" subtitle="Monthly settled loan value, last 12 months">
              {pipeline.totalLoans === 0 ? (
                <EmptyState />
              ) : (
                <TrendArea data={pipeline.monthlySettlements} />
              )}
            </Card>
          </div>
          <Card title="Stage breakdown" subtitle="Every loan currently on file">
            {pipeline.stageBreakdown.length === 0 ? (
              <EmptyState />
            ) : (
              <DonutBreakdown data={pipeline.stageBreakdown} centerLabel="Loans" />
            )}
          </Card>
        </div>
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

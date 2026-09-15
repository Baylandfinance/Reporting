import { CircleCheck, Clock, FileCheck2, GitBranch, MessageCircleQuestion, XCircle } from "lucide-react";
import { requireSessionProfile } from "@/lib/auth/session";
import { Topbar } from "@/components/nav/Topbar";
import { StatTile } from "@/components/charts/StatTile";
import { Card } from "@/components/charts/Card";
import { TrendArea } from "@/components/charts/TrendArea";
import { DonutBreakdown } from "@/components/charts/DonutBreakdown";
import { getPipelineOverview, getMonthlyActivity } from "@/lib/reports/queries";

export default async function PipelinePage() {
  const profile = await requireSessionProfile();
  const [pipeline, activity] = await Promise.all([
    getPipelineOverview(profile),
    getMonthlyActivity(profile),
  ]);

  return (
    <>
      <Topbar
        title="Pipeline & Settlements"
        subtitle="Loans by stage, and monthly trend across the funnel."
      />
      <main className="flex-1 space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Loans in flight" value={String(Math.max(pipeline.inFlightCount, 0))} icon={GitBranch} />
          <StatTile label="Settled" value={String(pipeline.settledCount)} icon={CircleCheck} />
          <StatTile label="Lost" value={String(pipeline.lostCount)} icon={XCircle} />
          <StatTile label="Conversion rate" value={`${pipeline.conversionRate}%`} icon={Clock} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile label="Leads this month" value={String(activity.leadsThisMonth)} icon={MessageCircleQuestion} />
          <StatTile label="Submissions this month" value={String(activity.submissionsThisMonth)} icon={FileCheck2} />
          <StatTile label="Settlements this month" value={String(activity.settlementsThisMonth)} icon={CircleCheck} />
        </div>

        <Card
          title="Leads / enquiries"
          subtitle="New enquiries received per month, last 12 months"
        >
          {pipeline.totalLoans === 0 ? (
            <EmptyState />
          ) : (
            <TrendArea data={activity.leadsMonthly} format="count" />
          )}
        </Card>

        <Card
          title="Submissions"
          subtitle="Loans submitted per month, last 12 months"
        >
          {pipeline.totalLoans === 0 ? (
            <EmptyState />
          ) : (
            <TrendArea data={activity.submissionsMonthly} format="count" />
          )}
        </Card>

        <Card
          title="Settlement value"
          subtitle="Booked and settled loan value per month, last 12 months — a loan counts under its actual settlement date once recorded, otherwise its booked date"
        >
          {pipeline.totalLoans === 0 ? (
            <EmptyState />
          ) : (
            <TrendArea data={activity.settlementValueMonthly} format="currency" />
          )}
        </Card>

        <Card title="Stage breakdown" subtitle="Every loan currently on file">
          {pipeline.stageBreakdown.length === 0 ? (
            <EmptyState />
          ) : (
            <DonutBreakdown data={pipeline.stageBreakdown} centerLabel="Loans" />
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

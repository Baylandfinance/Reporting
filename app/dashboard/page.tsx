import { Briefcase, Target, TrendingUp, Wallet } from "lucide-react";
import { requireSessionProfile } from "@/lib/auth/session";
import { Topbar } from "@/components/nav/Topbar";
import { StatTile } from "@/components/charts/StatTile";
import { Card } from "@/components/charts/Card";
import { TrendArea } from "@/components/charts/TrendArea";
import { DonutBreakdown } from "@/components/charts/DonutBreakdown";
import { HorizontalBarList } from "@/components/charts/HorizontalBarList";
import {
  getPipelineOverview,
  getReferralBreakdown,
} from "@/lib/reports/queries";

const CURRENCY = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
  notation: "compact",
});

export default async function OverviewPage() {
  const profile = await requireSessionProfile();
  const [pipeline, referrals] = await Promise.all([
    getPipelineOverview(profile),
    getReferralBreakdown(profile),
  ]);

  return (
    <>
      <Topbar
        title="Overview"
        subtitle={
          profile.role === "admin"
            ? "Firm-wide pipeline, settlements and referral performance."
            : "Your pipeline, settlements and referral performance."
        }
      />

      <main className="flex-1 space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Total pipeline"
            value={CURRENCY.format(pipeline.totalPipelineValue)}
            icon={Briefcase}
          />
          <StatTile
            label="Settled this month"
            value={CURRENCY.format(pipeline.settledThisMonthValue)}
            icon={Wallet}
          />
          <StatTile
            label="Conversion rate"
            value={`${pipeline.conversionRate}%`}
            icon={Target}
          />
          <StatTile
            label="Avg loan size"
            value={CURRENCY.format(pipeline.avgLoanSize)}
            icon={TrendingUp}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card
              title="Settlement value"
              subtitle="Monthly settled loan value, last 12 months"
            >
              {pipeline.totalLoans === 0 ? (
                <EmptyState label="No loans recorded yet" />
              ) : (
                <TrendArea data={pipeline.monthlySettlements} />
              )}
            </Card>
          </div>

          <Card title="Pipeline by stage" subtitle="All active and closed loans">
            {pipeline.stageBreakdown.length === 0 ? (
              <EmptyState label="No loans recorded yet" />
            ) : (
              <DonutBreakdown data={pipeline.stageBreakdown} centerLabel="Loans" />
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Referral sources" subtitle="New clients by source">
            {referrals.byReferral.length === 0 ? (
              <EmptyState label="No clients recorded yet" />
            ) : (
              <HorizontalBarList data={referrals.byReferral} />
            )}
          </Card>

          <Card title="Client mix" subtitle="Owner-occupier, investor, commercial">
            {referrals.byClientType.length === 0 ? (
              <EmptyState label="No clients recorded yet" />
            ) : (
              <DonutBreakdown data={referrals.byClientType} centerLabel="Clients" />
            )}
          </Card>
        </div>
      </main>
    </>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-[180px] items-center justify-center text-sm text-ink-muted">
      {label}
    </div>
  );
}

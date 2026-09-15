import { Users2, UserPlus } from "lucide-react";
import { requireSessionProfile } from "@/lib/auth/session";
import { Topbar } from "@/components/nav/Topbar";
import { StatTile } from "@/components/charts/StatTile";
import { Card } from "@/components/charts/Card";
import { HorizontalBarList } from "@/components/charts/HorizontalBarList";
import { DonutBreakdown } from "@/components/charts/DonutBreakdown";
import { getReferralBreakdown } from "@/lib/reports/queries";

export default async function ReferralsPage() {
  const profile = await requireSessionProfile();
  const referrals = await getReferralBreakdown(profile);

  return (
    <>
      <Topbar title="Clients & Referrals" subtitle="Where new business comes from." />
      <main className="flex-1 space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatTile label="Total clients" value={String(referrals.totalClients)} icon={Users2} />
          <StatTile label="Referral sources" value={String(referrals.byReferral.length)} icon={UserPlus} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="New clients by source" subtitle="All-time">
            {referrals.byReferral.length === 0 ? (
              <EmptyState />
            ) : (
              <HorizontalBarList data={referrals.byReferral} />
            )}
          </Card>
          <Card title="Client mix" subtitle="Owner-occupier, investor, commercial">
            {referrals.byClientType.length === 0 ? (
              <EmptyState />
            ) : (
              <DonutBreakdown data={referrals.byClientType} centerLabel="Clients" />
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
      No clients recorded yet.
    </div>
  );
}

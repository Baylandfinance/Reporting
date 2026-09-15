import { Banknote, Clock, TrendingDown, TrendingUp } from "lucide-react";
import { requireSessionProfile } from "@/lib/auth/session";
import { Topbar } from "@/components/nav/Topbar";
import { StatTile } from "@/components/charts/StatTile";
import { Card } from "@/components/charts/Card";
import { DonutBreakdown } from "@/components/charts/DonutBreakdown";
import { getCommissionSummary } from "@/lib/reports/queries";

const CURRENCY = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

export default async function CommissionsPage() {
  const profile = await requireSessionProfile();
  const commissions = await getCommissionSummary(profile);

  const hasData =
    commissions.totalPaid + commissions.totalExpected + commissions.totalClawedBack > 0;

  return (
    <>
      <Topbar title="Commissions" subtitle="Upfront and trail commission tracking." />
      <main className="flex-1 space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Paid" value={CURRENCY.format(commissions.totalPaid)} icon={Banknote} deltaDirection="up" />
          <StatTile label="Expected" value={CURRENCY.format(commissions.totalExpected)} icon={Clock} />
          <StatTile
            label="Clawed back"
            value={CURRENCY.format(commissions.totalClawedBack)}
            icon={TrendingDown}
            deltaDirection={commissions.totalClawedBack > 0 ? "down" : "neutral"}
          />
          <StatTile label="Upfront vs trail" value={`${CURRENCY.format(commissions.upfrontTotal)} / ${CURRENCY.format(commissions.trailTotal)}`} icon={TrendingUp} />
        </div>

        <Card title="Commission mix" subtitle="Paid, expected and clawed back">
          {hasData ? (
            <DonutBreakdown
              data={[
                { label: "Paid", value: commissions.totalPaid },
                { label: "Expected", value: commissions.totalExpected },
                { label: "Clawed back", value: commissions.totalClawedBack },
              ]}
              centerLabel="AUD"
            />
          ) : (
            <div className="flex h-[180px] items-center justify-center text-sm text-ink-muted">
              No commission records yet.
            </div>
          )}
        </Card>
      </main>
    </>
  );
}

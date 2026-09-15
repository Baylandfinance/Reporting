import { Landmark, Wallet } from "lucide-react";
import { requireSessionProfile } from "@/lib/auth/session";
import { Topbar } from "@/components/nav/Topbar";
import { StatTile } from "@/components/charts/StatTile";
import { Card } from "@/components/charts/Card";
import { HorizontalBarList } from "@/components/charts/HorizontalBarList";
import { getLenderMix } from "@/lib/reports/queries";

const CURRENCY = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
  notation: "compact",
});

export default async function LendersPage() {
  const profile = await requireSessionProfile();
  const lenderMix = await getLenderMix(profile);

  return (
    <>
      <Topbar title="Lenders & Products" subtitle="Volume by lender across the book." />
      <main className="flex-1 space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatTile label="Lenders in use" value={String(lenderMix.byLender.length)} icon={Landmark} />
          <StatTile label="Total loan volume" value={CURRENCY.format(lenderMix.totalValue)} icon={Wallet} />
        </div>

        <Card title="Loan volume by lender" subtitle="Number of loans written, all stages">
          {lenderMix.byLender.length === 0 ? (
            <div className="flex h-[180px] items-center justify-center text-sm text-ink-muted">
              No loans recorded yet.
            </div>
          ) : (
            <HorizontalBarList data={lenderMix.byLender} />
          )}
        </Card>
      </main>
    </>
  );
}

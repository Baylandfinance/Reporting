import { requireRole } from "@/lib/auth/rbac";
import { Topbar } from "@/components/nav/Topbar";
import { ReportControls } from "@/components/reports/ReportControls";
import { TeamPerformanceView } from "@/components/reports/TeamPerformanceView";
import { getManagementReport } from "@/lib/reports/queries";
import { resolveReportMonth, selectableMonths } from "@/lib/reports/management";

export default async function TeamPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Firm-wide figures — admin only (RLS gives admins the whole book).
  const profile = await requireRole("admin");
  const { month } = await searchParams;
  const reportMonth = resolveReportMonth(typeof month === "string" ? month : undefined);
  const report = await getManagementReport(profile, "team_performance", reportMonth);

  return (
    <>
      <Topbar title="Broker Team Performance" subtitle="Settlements and weighted pipeline against each team's goal." />
      <main className="flex-1 space-y-6 p-6">
        <ReportControls months={selectableMonths()} selected={report.months[report.months.length - 1]!.key} />
        <TeamPerformanceView report={report} />
      </main>
    </>
  );
}

import { requireRole } from "@/lib/auth/rbac";
import { Topbar } from "@/components/nav/Topbar";
import { ReportControls } from "@/components/reports/ReportControls";
import { LeadsView } from "@/components/reports/LeadsView";
import { getLeadsReport } from "@/lib/reports/queries";
import { resolveReportMonth, selectableMonths } from "@/lib/reports/management";

export default async function LeadsMarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Firm-wide figures — admin only (RLS gives admins the whole book).
  const profile = await requireRole("admin");
  const { month } = await searchParams;
  const reportMonth = resolveReportMonth(typeof month === "string" ? month : undefined);
  const report = await getLeadsReport(profile, reportMonth);

  return (
    <>
      <Topbar
        title="Leads Marketing Report"
        subtitle="Monthly lead volumes by loan type and lead source, rolling 10 months, from the uploaded spreadsheet."
      />
      <main className="flex-1 space-y-6 p-6">
        <ReportControls months={selectableMonths()} selected={report.months[report.months.length - 1]!.key} />
        <LeadsView report={report} />
      </main>
    </>
  );
}

import { requireRole } from "@/lib/auth/rbac";
import { Topbar } from "@/components/nav/Topbar";
import { ReportControls } from "@/components/reports/ReportControls";
import { AverageLoanSizeView } from "@/components/reports/AverageLoanSizeView";
import { getManagementReport } from "@/lib/reports/queries";
import { resolveReportMonth, selectableMonths } from "@/lib/reports/management";

export default async function AverageLoanSizePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Firm-wide figures — admin only (RLS gives admins the whole book).
  const profile = await requireRole("admin");
  const { month } = await searchParams;
  const reportMonth = resolveReportMonth(typeof month === "string" ? month : undefined);
  const report = await getManagementReport(profile, "average_loan_size", reportMonth);

  return (
    <>
      <Topbar title="Average Loan Size" subtitle="Average settled loan by month and financial year, and average loan at each pipeline stage." />
      <main className="flex-1 space-y-6 p-6">
        <ReportControls months={selectableMonths()} selected={report.months[report.months.length - 1]!.key} />
        <AverageLoanSizeView report={report} />
      </main>
    </>
  );
}

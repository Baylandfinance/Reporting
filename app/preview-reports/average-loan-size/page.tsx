import { Topbar } from "@/components/nav/Topbar";
import { ReportControls } from "@/components/reports/ReportControls";
import { AverageLoanSizeView } from "@/components/reports/AverageLoanSizeView";
import { buildManagementReport } from "@/lib/reports/management";
import { buildDummyRows } from "../dummy-rows";

// PREVIEW ONLY — the real report component, fed synthetic rows built from
// the specification's dummy figures at 31 Oct 2026. No database access.
export default function AverageLoanSizePreview() {
  const rows = buildDummyRows();
  const report = buildManagementReport(rows, rows.length, { year: 2026, monthIndex: 9 });
  return (
    <>
      <Topbar title="Average Loan Size" subtitle="Dummy data from the specification." />
      <main className="flex-1 space-y-6 p-6">
        <ReportControls months={[report.reportMonth]} selected={report.reportMonth.key} />
        <AverageLoanSizeView report={report} />
      </main>
    </>
  );
}

import { Topbar } from "@/components/nav/Topbar";
import { ReportControls } from "@/components/reports/ReportControls";
import { TeamPerformanceView } from "@/components/reports/TeamPerformanceView";
import { buildManagementReport } from "@/lib/reports/management";
import { buildDummyRows } from "../dummy-rows";

// PREVIEW ONLY — the real report component, fed synthetic rows built from
// the specification's dummy figures at 31 Oct 2026. No database access.
export default function TeamPerformancePreview() {
  const rows = buildDummyRows();
  const report = buildManagementReport(rows, rows.length, { year: 2026, monthIndex: 9 });
  return (
    <>
      <Topbar title="Broker Team Performance" subtitle="Dummy data from the specification." />
      <main className="flex-1 space-y-6 p-6">
        <ReportControls months={[report.reportMonth]} selected={report.reportMonth.key} />
        <TeamPerformanceView report={report} />
      </main>
    </>
  );
}

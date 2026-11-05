import { Topbar } from "@/components/nav/Topbar";
import { ReportControls } from "@/components/reports/ReportControls";
import { LeadsView } from "@/components/reports/LeadsView";
import { buildLeadsReport } from "@/lib/reports/leads";
import { buildDummyLeadRows } from "../dummy-leads";

// PREVIEW ONLY — the real report component, fed synthetic rows built from
// the Leads Marketing specification's dummy data. No database access.
export default function LeadsPreview() {
  const rows = buildDummyLeadRows();
  const report = buildLeadsReport(rows, rows.length, { year: 2026, monthIndex: 9 });
  return (
    <>
      <Topbar title="Leads Marketing Report" subtitle="Dummy data from the specification." />
      <main className="flex-1 space-y-6 p-6">
        <ReportControls months={[report.reportMonth]} selected={report.reportMonth.key} />
        <LeadsView report={report} />
      </main>
    </>
  );
}

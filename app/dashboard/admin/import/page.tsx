import { requireRole } from "@/lib/auth/rbac";
import { Topbar } from "@/components/nav/Topbar";
import { Card } from "@/components/charts/Card";
import { UploadForm } from "./upload-form";
import { GraphPanel } from "./graph-panel";
import { getGraphConnectionStatus, isMicrosoftAccountConnected } from "./graph-actions";

export default async function ImportPage() {
  await requireRole("admin");
  const [accountConnected, status] = await Promise.all([
    isMicrosoftAccountConnected(),
    getGraphConnectionStatus(),
  ]);

  return (
    <>
      <Topbar
        title="Import Data"
        subtitle="Load clients and loans from a spreadsheet export."
      />
      <main className="flex-1 space-y-6 p-6">
        <Card
          title="Automatic sync from Excel Online"
          subtitle="Connects directly to your workbook and refreshes twice a day."
        >
          <GraphPanel initialAccountConnected={accountConnected} initialStatus={status} />
        </Card>

        <Card
          title="Upload spreadsheet"
          subtitle="A .xlsx file exported from your loan tracker — same column layout as your existing sheet."
        >
          <UploadForm />
        </Card>

        <div className="rounded-xl border border-grid bg-surface p-5 text-sm text-ink-secondary dark:border-grid-dark dark:bg-surface-dark dark:text-ink-secondary-dark">
          <p className="mb-2 font-medium text-ink dark:text-ink-dark">Before you upload</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              The first row must be column headers — <code>Client Name</code>,{" "}
              <code>Status</code> and <code>Broker</code> are required; everything else is
              optional.
            </li>
            <li>
              The name in the <code>Broker</code> column must exactly match a staff member&apos;s
              name under <strong>Users &amp; Access</strong> — otherwise that row is skipped.
            </li>
            <li>
              Uploading again is safe: rows are matched and updated, not duplicated, so you can
              re-upload the same file after fixing errors.
            </li>
          </ul>
        </div>
      </main>
    </>
  );
}

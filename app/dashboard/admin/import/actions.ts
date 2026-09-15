"use server";

import { requireRole } from "@/lib/auth/rbac";
import { parseWorkbookFirstSheet } from "@/lib/import/parseWorkbook";
import { syncWorksheetRows, type SyncResult } from "@/lib/import/syncRows";
import { logAuditEvent } from "@/lib/audit/log";

export async function uploadSpreadsheet(formData: FormData): Promise<SyncResult> {
  const admin = await requireRole("admin");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { synced: 0, errors: ["No file was selected."] };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { synced: 0, errors: ["Please upload a .xlsx file (the format Excel Online saves in)."] };
  }

  const buffer = await file.arrayBuffer();
  const { worksheetName, rows } = await parseWorkbookFirstSheet(buffer);

  const result = await syncWorksheetRows(rows, `upload:${file.name}`);

  await logAuditEvent({
    actorId: admin.id,
    action: "manual_import",
    resourceType: "spreadsheet_upload",
    metadata: { fileName: file.name, worksheetName, synced: result.synced, errorCount: result.errors.length },
  });

  return result;
}

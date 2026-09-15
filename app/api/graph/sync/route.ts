import { NextResponse, type NextRequest } from "next/server";
import { logAuditEvent } from "@/lib/audit/log";
import { runGraphSync } from "@/lib/import/runGraphSync";

/**
 * Scheduled entry point only — Vercel Cron calls this once a day (see the
 * `crons` block in vercel.json). Cron requests carry no user session, so
 * this is gated by a shared secret instead of requireRole: Vercel sends
 * `Authorization: Bearer ${CRON_SECRET}` automatically for cron-triggered
 * requests, matched against the same env var here.
 *
 * The admin's manual "Sync now" button does NOT go through this route — it
 * calls triggerGraphSync() (app/dashboard/admin/import/graph-actions.ts)
 * directly as a server action, under its own admin-session check.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runGraphSync();

  await logAuditEvent({
    actorId: null,
    action: "graph_sync_scheduled",
    resourceType: "graph_connections",
    metadata: {
      synced: result.synced,
      errorCount: result.errors.length,
      unattributedCount: result.unattributedByBroker.reduce((s, b) => s + b.count, 0),
    },
  });

  return NextResponse.json(result);
}

import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/audit/log";
import { runGraphSync } from "@/lib/import/runGraphSync";

/**
 * Scheduled entry point — Vercel Cron calls this twice a day (see the
 * `crons` block in vercel.json). Cron requests carry no user session, so
 * this is gated by a shared secret instead of requireRole: Vercel sends
 * `Authorization: Bearer ${CRON_SECRET}` automatically for cron-triggered
 * requests, matched against the same env var here.
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
    metadata: { synced: result.synced, errorCount: result.errors.length },
  });

  return NextResponse.json(result);
}

/** Manual "Sync now" button on the Import Data page — requires an admin session. */
export async function POST() {
  const admin = await requireRole("admin");
  const result = await runGraphSync();

  await logAuditEvent({
    actorId: admin.id,
    action: "graph_sync_manual",
    resourceType: "graph_connections",
    metadata: { synced: result.synced, errorCount: result.errors.length },
  });

  return NextResponse.json(result);
}

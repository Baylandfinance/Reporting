"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/rbac";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/graph/crypto";
import { refreshAccessToken, resolveShareLink, listWorksheetNames } from "@/lib/graph/client";
import { logAuditEvent } from "@/lib/audit/log";
import { runGraphSync } from "@/lib/import/runGraphSync";
import type { SyncResult } from "@/lib/import/syncRows";

export type GraphConnectionStatus = {
  connected: boolean;
  fileName: string | null;
  lastSyncedAt: string | null;
};

export async function getGraphConnectionStatus(): Promise<GraphConnectionStatus> {
  await requireRole("admin");
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("graph_connections")
    .select("file_name, drive_id, drive_item_id, last_synced_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    connected: Boolean(data?.drive_id && data?.drive_item_id),
    fileName: data?.file_name ?? null,
    lastSyncedAt: data?.last_synced_at ?? null,
  };
}

export async function isMicrosoftAccountConnected(): Promise<boolean> {
  await requireRole("admin");
  const supabase = createServiceRoleClient();
  const { count } = await supabase
    .from("graph_connections")
    .select("id", { count: "exact", head: true });
  return (count ?? 0) > 0;
}

/** Saves the workbook a pasted SharePoint/OneDrive sharing link points to. */
export async function connectWorkbookLink(shareUrl: string): Promise<{ error?: string }> {
  const admin = await requireRole("admin");
  const supabase = createServiceRoleClient();

  const { data: connection } = await supabase
    .from("graph_connections")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!connection) {
    return { error: "Connect your Microsoft 365 account first." };
  }

  try {
    const refreshToken = decryptToken({
      encrypted: connection.encrypted_refresh_token,
      iv: connection.token_iv,
      authTag: connection.token_auth_tag,
    });

    const tokens = await refreshAccessToken({
      tenantId: connection.tenant_id,
      clientId: process.env.MS_GRAPH_CLIENT_ID!,
      clientSecret: process.env.MS_GRAPH_CLIENT_SECRET!,
      refreshToken,
    });

    const resolved = await resolveShareLink(shareUrl, tokens.access_token);
    const worksheetNames = await listWorksheetNames(
      tokens.access_token,
      resolved.driveId,
      resolved.itemId
    );

    const { error } = await supabase
      .from("graph_connections")
      .update({
        drive_id: resolved.driveId,
        drive_item_id: resolved.itemId,
        file_name: resolved.name,
        worksheet_names: worksheetNames.slice(0, 1), // default to the first tab
      })
      .eq("id", connection.id);

    if (error) return { error: error.message };

    await logAuditEvent({
      actorId: admin.id,
      action: "connect_graph_workbook",
      resourceType: "graph_connections",
      resourceId: connection.id,
      metadata: { fileName: resolved.name },
    });

    revalidatePath("/dashboard/admin/import");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong resolving that link." };
  }
}

export async function triggerGraphSync(): Promise<SyncResult> {
  const admin = await requireRole("admin");
  const result = await runGraphSync();

  await logAuditEvent({
    actorId: admin.id,
    action: "graph_sync_manual",
    resourceType: "graph_connections",
    metadata: {
      synced: result.synced,
      errorCount: result.errors.length,
      skippedBrokerCount: result.skippedByBroker.reduce((s, b) => s + b.count, 0),
    },
  });

  revalidatePath("/dashboard/admin/import");
  return result;
}

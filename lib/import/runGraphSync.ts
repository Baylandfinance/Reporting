import { refreshAccessToken, fetchWorksheetValues } from "@/lib/graph/client";
import { decryptToken } from "@/lib/graph/crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncWorksheetRows, type SyncResult } from "./syncRows";

/**
 * The actual Graph sync, shared by the admin's manual "Sync now" button
 * (app/dashboard/admin/import) and the twice-daily scheduled job
 * (app/api/graph/sync's GET handler, called by Vercel Cron). Neither of
 * those needs to duplicate the "load connection, refresh token, fetch
 * worksheet, upsert rows" sequence.
 */
export async function runGraphSync(): Promise<SyncResult> {
  const supabase = createServiceRoleClient();

  const { data: connection } = await supabase
    .from("graph_connections")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!connection) {
    return {
      synced: 0,
      errors: ["No Microsoft 365 account is connected yet."],
      unattributedByBroker: [],
    };
  }
  if (!connection.drive_id || !connection.drive_item_id) {
    return {
      synced: 0,
      errors: ["Connected, but no workbook link has been saved yet."],
      unattributedByBroker: [],
    };
  }

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

  const worksheetName = connection.worksheet_names[0] ?? "Sheet1";
  const rows = await fetchWorksheetValues({
    accessToken: tokens.access_token,
    driveId: connection.drive_id,
    itemId: connection.drive_item_id,
    worksheetName,
  });

  const result = await syncWorksheetRows(rows, `onedrive:${connection.file_name ?? worksheetName}`);

  await supabase
    .from("graph_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", connection.id);

  return result;
}

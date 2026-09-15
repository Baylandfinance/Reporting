import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { refreshAccessToken, fetchWorksheetValues } from "@/lib/graph/client";
import { decryptToken } from "@/lib/graph/crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit/log";
import type { AuState } from "@/lib/types/database";

// Column names as they appear in the real "Application Management"
// workbook — see docs/SETUP.md "Excel Online sheet format". Matching is
// case-insensitive and trims whitespace; column order in the sheet doesn't
// matter.
const REQUIRED_COLUMNS = ["client name", "status", "broker"] as const;

const STATE_MAP: Record<string, AuState> = {
  vic: "vic",
  nsw: "nsw",
  qld: "qld",
  sa: "sa",
  wa: "wa",
  tas: "tas",
  nt: "nt",
  act: "act",
};

// Excel's day-0 is 1899-12-30 in the (buggy, but universal) 1900 date
// system Graph/Excel Online both use for the values array.
function excelSerialToISODate(value: string): string | null {
  const serial = Number(value);
  if (!value || Number.isNaN(serial)) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function indexHeaders(headerRow: string[]) {
  const index: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    index[String(h ?? "").trim().toLowerCase()] = i;
  });
  return index;
}

/**
 * Looks up a reference-table row by case-insensitive/trimmed name, creating
 * it if it doesn't exist yet — lenders, lead sources and pipeline stages in
 * the source sheet are free text an admin can still curate afterwards
 * (rename, merge, recategorise) without the sync choking on a new value.
 */
async function findOrCreateByName(
  supabase: ReturnType<typeof createServiceRoleClient>,
  table: "lenders" | "lead_sources" | "pipeline_stages" | "brokerages",
  cache: Map<string, string>,
  rawName: string
): Promise<string | null> {
  const name = rawName.trim();
  if (!name) return null;
  const key = name.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  const { data: existing } = await supabase
    .from(table)
    .select("id, name")
    .ilike("name", name)
    .maybeSingle();

  if (existing) {
    cache.set(key, existing.id);
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from(table)
    .insert({ name } as never)
    .select("id")
    .single();

  if (error || !created) return null;
  cache.set(key, created.id);
  return created.id;
}

/**
 * Pulls the configured worksheet from Excel Online and upserts clients,
 * loans and their commission figures. Admin-triggered only for now — wire
 * this to a scheduled Vercel Cron hitting this route with a shared secret
 * once the mapping has been verified against a real sync run, rather than
 * running it unattended first.
 */
export async function POST() {
  const admin = await requireRole("admin");
  const supabase = createServiceRoleClient();

  const { data: connection } = await supabase
    .from("graph_connections")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!connection) {
    return NextResponse.json({ error: "No Microsoft Graph connection configured." }, { status: 400 });
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
    driveItemId: connection.drive_item_id,
    worksheetName,
  });

  if (rows.length < 2) {
    return NextResponse.json({ synced: 0, message: "Worksheet has no data rows." });
  }

  const [headerRow, ...dataRows] = rows;
  const columns = indexHeaders(headerRow ?? []);
  const missing = REQUIRED_COLUMNS.filter((c) => !(c in columns));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Worksheet is missing required column(s): ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  const { data: brokerProfiles } = await supabase.from("profiles").select("id, full_name");
  const brokerByName = new Map(
    (brokerProfiles ?? []).map((b) => [b.full_name.trim().toLowerCase(), b.id])
  );
  const lenderCache = new Map<string, string>();
  const leadSourceCache = new Map<string, string>();
  const stageCache = new Map<string, string>();
  const brokerageCache = new Map<string, string>();

  let synced = 0;
  const errors: string[] = [];

  for (const [rowIndex, row] of dataRows.entries()) {
    const get = (col: string) =>
      columns[col] !== undefined ? String(row[columns[col]] ?? "").trim() : "";
    const getDate = (col: string) =>
      columns[col] !== undefined ? excelSerialToISODate(String(row[columns[col]] ?? "")) : null;
    const getNumber = (col: string) => {
      const raw = get(col).replace(/[^0-9.-]/g, "");
      return raw ? Number(raw) : null;
    };

    const clientNameRaw = get("client name");
    const brokerNameRaw = get("broker");
    const ownerBrokerId = brokerByName.get(brokerNameRaw.toLowerCase());

    if (!clientNameRaw) {
      errors.push(`Row ${rowIndex + 2}: missing client name, skipped`);
      continue;
    }
    if (!ownerBrokerId) {
      errors.push(
        `Row ${rowIndex + 2}: no staff account matches broker "${brokerNameRaw}" — add them under Users & Access first`
      );
      continue;
    }

    const leadSourceId = await findOrCreateByName(
      supabase,
      "lead_sources",
      leadSourceCache,
      get("lead origination")
    );
    const brokerageId = await findOrCreateByName(
      supabase,
      "brokerages",
      brokerageCache,
      get("brokerage")
    );
    const lenderId = await findOrCreateByName(supabase, "lenders", lenderCache, get("lender"));
    const stageId = await findOrCreateByName(
      supabase,
      "pipeline_stages",
      stageCache,
      get("status")
    );

    const stateRaw = get("state").toLowerCase().replace(/\./g, "");
    const propertyState = STATE_MAP[stateRaw] ?? null;

    // client_type is deliberately never written here — see migration notes
    // on why it isn't auto-classified from the messy source data. Omitting
    // it from the upsert payload (rather than setting it to null) means a
    // classification a broker has since set manually in the UI survives
    // every future sync instead of being wiped back to "Unclassified".
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .upsert(
        {
          full_name: clientNameRaw,
          referrer_name: get("referrer") || null,
          lead_source_id: leadSourceId,
          owner_broker_id: ownerBrokerId,
        },
        { onConflict: "owner_broker_id,full_name" }
      )
      .select("id")
      .single();

    if (clientError || !client) {
      errors.push(`Row ${rowIndex + 2}: failed to upsert client (${clientError?.message})`);
      continue;
    }

    const sourceRowRef = `${worksheetName}!row${rowIndex + 2}`;

    const { data: loan, error: loanError } = await supabase
      .from("loans")
      .upsert(
        {
          client_id: client.id,
          lender_id: lenderId,
          brokerage_id: brokerageId,
          owner_broker_id: ownerBrokerId,
          pipeline_stage_id: stageId,
          transaction_type_raw: get("transaction type") || null,
          property_state: propertyState,
          loan_amount: getNumber("loan_amount"),
          loan_administrator_name: get("loan administrator") || null,
          parabroker_name: get("parabroker") || null,
          processor_name: get("processor") || null,
          enquiry_date: getDate("enquiry date"),
          quote_date: getDate("quote date"),
          application_date: getDate("application date"),
          submission_date: getDate("submission date"),
          conditional_approval_date: getDate("conditional approval date"),
          unconditional_approval_date: getDate("unconditional approval date"),
          settlement_booked_date: getDate("settlement booked date"),
          settlement_date: getDate("settlement date"),
          comment: get("comment") || null,
          source_row_ref: sourceRowRef,
        },
        { onConflict: "source_row_ref" }
      )
      .select("id")
      .single();

    if (loanError || !loan) {
      errors.push(`Row ${rowIndex + 2}: failed to upsert loan (${loanError?.message})`);
      continue;
    }

    const { error: commissionError } = await supabase.from("loan_commissions").upsert(
      {
        loan_id: loan.id,
        commission_received_date: getDate("commission received"),
        upfront_commission: getNumber("upfront commission"),
        trail_commission: getNumber("trail commission"),
        referral_upfront_split_pct: getNumber("refferal upfront commission split"),
        referral_trail_split_pct: getNumber("refferal trail commission split"),
        broker_upfront_commission: getNumber("broker upfront commission"),
        broker_trail_commission: getNumber("broker trail commission"),
        referral_upfront_commission: getNumber("referral upfront commission"),
        referral_trail_commission: getNumber("referral trail commission"),
        commission_payment_date: getDate("commission payment date"),
        referral_commission_payment_date: getDate("refferal commission payment date"),
        clawback_amount: getNumber("clawback"),
        clawback_date: getDate("clawback date"),
      },
      { onConflict: "loan_id" }
    );

    if (commissionError) {
      errors.push(`Row ${rowIndex + 2}: failed to upsert commission figures (${commissionError.message})`);
      continue;
    }

    synced += 1;
  }

  await supabase
    .from("graph_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", connection.id);

  await logAuditEvent({
    actorId: admin.id,
    action: "graph_sync",
    resourceType: "graph_connections",
    resourceId: connection.id,
    metadata: { synced, errorCount: errors.length },
  });

  return NextResponse.json({ synced, errors });
}

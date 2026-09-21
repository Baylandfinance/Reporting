import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit/log";
import type { Database } from "@/lib/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * All report queries go through the anon-key server client, so RLS applies:
 * a broker's numbers are already scoped to their own book by the database,
 * not by anything in this file. Each function logs one audit event per
 * report view rather than per row — enough to reconstruct "who looked at
 * the book, and when" without flooding audit_log on every render. The audit
 * write runs concurrently with the actual data fetch (started, then awaited
 * together at the end) rather than being awaited up front, so it's no
 * longer an extra network round trip sitting in front of every report.
 */
function startAuditReportView(profile: Profile, report: string): Promise<void> {
  return logAuditEvent({
    actorId: profile.id,
    action: "view_report",
    resourceType: report,
  });
}

const PAGE_SIZE = 1000;

/** A cheap head-only count, still RLS-scoped — used to size the parallel page fetch below. */
async function countRows(
  supabase: SupabaseClient,
  table: "loans" | "loan_commissions" | "clients"
): Promise<number> {
  const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

/**
 * Supabase's REST API caps any single request at 1,000 rows by default,
 * silently — a `.select()` on a table with 3,500 rows returns only the
 * first 1,000 with no error and no indication of truncation. Every report
 * here aggregates in JS rather than in SQL, so it must page through the
 * full result set itself. Pages are fetched in parallel (not one after
 * another) since we know the total up front from countRows() — a 3,500-row
 * table is 4 requests either way, but concurrently they cost about as long
 * as one.
 */
async function selectAllRows<T>(
  total: number,
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  if (total === 0) return [];
  const pageStarts: number[] = [];
  for (let from = 0; from < total; from += PAGE_SIZE) pageStarts.push(from);

  const pages = await Promise.all(pageStarts.map((from) => query(from, from + PAGE_SIZE - 1)));

  const all: T[] = [];
  for (const { data, error } of pages) {
    if (!error && data) all.push(...data);
  }
  return all;
}

/**
 * Small reference tables (pipeline_stages, lenders, lead_sources — tens to
 * a few hundred rows) are fetched once as id->row maps instead of embedded
 * on every row of a large query (`loans.select("...,lenders(name)")`) —
 * embedding asks Postgres to join the reference table in for each of
 * thousands of rows; a separate one-off fetch plus a JS Map lookup does the
 * same join far more cheaply at this scale.
 */
async function fetchLookup(
  supabase: SupabaseClient,
  table: "pipeline_stages" | "lenders" | "lead_sources" | "profiles",
  columns: string
): Promise<Map<string, Record<string, unknown>>> {
  const { data } = await supabase.from(table).select(columns);
  const map = new Map<string, Record<string, unknown>>();
  for (const row of (data ?? []) as unknown as { id: string }[]) {
    map.set(row.id, row as unknown as Record<string, unknown>);
  }
  return map;
}

export async function getPipelineOverview(profile: Profile) {
  const supabase = (await createClient()) as SupabaseClient;
  const auditPromise = startAuditReportView(profile, "pipeline_overview");

  type LoanForPipeline = {
    loan_amount: number | null;
    settlement_date: string | null;
    pipeline_stage_id: string | null;
  };

  const [total, stagesById] = await Promise.all([
    countRows(supabase, "loans"),
    fetchLookup(supabase, "pipeline_stages", "id, name, category"),
  ]);
  const rows = await selectAllRows<LoanForPipeline>(total, (from, to) =>
    supabase
      .from("loans")
      .select("loan_amount, settlement_date, pipeline_stage_id")
      .range(from, to) as unknown as PromiseLike<{ data: LoanForPipeline[] | null; error: unknown }>
  );

  const categoryOf = (l: LoanForPipeline) =>
    l.pipeline_stage_id ? (stagesById.get(l.pipeline_stage_id)?.category as string | undefined) : undefined;
  const nameOf = (l: LoanForPipeline) =>
    (l.pipeline_stage_id && (stagesById.get(l.pipeline_stage_id)?.name as string | undefined)) ??
    "Unclassified";

  const now = new Date();
  // Settled means "has a settlement date" — see getPipelineAndActivity for
  // why this doesn't depend on the (fallible, manually-maintained) stage
  // category classification.
  const settledThisMonth = rows.filter((l) => {
    if (!l.settlement_date) return false;
    const d = new Date(l.settlement_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalPipelineValue = rows
    .filter((l) => {
      const cat = categoryOf(l);
      return cat === "lead" || cat === "active" || cat === "on_hold";
    })
    .reduce((sum, l) => sum + (l.loan_amount ?? 0), 0);

  const settledCount = rows.filter((l) => l.settlement_date != null).length;
  const lostCount = rows.filter((l) => categoryOf(l) === "lost").length;
  const conversionRate =
    settledCount + lostCount > 0
      ? Math.round((settledCount / (settledCount + lostCount)) * 100)
      : 0;

  const avgLoanSize =
    rows.length > 0
      ? Math.round(rows.reduce((s, l) => s + (l.loan_amount ?? 0), 0) / rows.length)
      : 0;

  const stageCounts: Record<string, number> = {};
  for (const l of rows) {
    const name = nameOf(l);
    stageCounts[name] = (stageCounts[name] ?? 0) + 1;
  }

  const sortedStages = Object.entries(stageCounts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const topStages = sortedStages.slice(0, 5);
  const otherStagesTotal = sortedStages.slice(5).reduce((s, x) => s + x.value, 0);
  const stageBreakdown =
    otherStagesTotal > 0 ? [...topStages, { label: "Other", value: otherStagesTotal }] : topStages;

  // Settlement value by month, last 12 months — actually-settled loans only.
  const monthly: { label: string; value: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString("en-AU", { month: "short" });
    const value = rows
      .filter((l) => {
        if (!l.settlement_date) return false;
        const sd = new Date(l.settlement_date);
        return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
      })
      .reduce((s, l) => s + (l.loan_amount ?? 0), 0);
    monthly.push({ label, value });
  }

  await auditPromise;

  return {
    totalPipelineValue,
    settledThisMonthValue: settledThisMonth.reduce((s, l) => s + (l.loan_amount ?? 0), 0),
    conversionRate,
    avgLoanSize,
    stageBreakdown,
    monthlySettlements: monthly,
    totalLoans: rows.length,
    settledCount,
    lostCount,
    inFlightCount: rows.length - settledCount - lostCount,
  };
}

export async function getCommissionSummary(profile: Profile) {
  const supabase = (await createClient()) as SupabaseClient;
  const auditPromise = startAuditReportView(profile, "commission_summary");

  type CommissionRow = {
    upfront_commission: number | null;
    trail_commission: number | null;
    clawback_amount: number | null;
    commission_payment_date: string | null;
  };

  const total = await countRows(supabase, "loan_commissions");
  const rows = await selectAllRows<CommissionRow>(total, (from, to) =>
    supabase
      .from("loan_commissions")
      .select("upfront_commission, trail_commission, clawback_amount, commission_payment_date")
      .range(from, to) as unknown as PromiseLike<{ data: CommissionRow[] | null; error: unknown }>
  );

  const paid = rows.filter((c) => c.commission_payment_date);
  const expected = rows.filter((c) => !c.commission_payment_date);

  const sum = (vals: (number | null)[]) => vals.reduce((s: number, v) => s + (v ?? 0), 0);

  await auditPromise;

  return {
    totalPaid: sum(paid.map((c) => (c.upfront_commission ?? 0) + (c.trail_commission ?? 0))),
    totalExpected: sum(
      expected.map((c) => (c.upfront_commission ?? 0) + (c.trail_commission ?? 0))
    ),
    totalClawedBack: sum(rows.map((c) => c.clawback_amount)),
    upfrontTotal: sum(rows.map((c) => c.upfront_commission)),
    trailTotal: sum(rows.map((c) => c.trail_commission)),
  };
}

export async function getLenderMix(profile: Profile) {
  const supabase = (await createClient()) as SupabaseClient;
  const auditPromise = startAuditReportView(profile, "lender_mix");

  type LoanForLenderMix = { loan_amount: number | null; lender_id: string | null };

  const [total, lendersById] = await Promise.all([
    countRows(supabase, "loans"),
    fetchLookup(supabase, "lenders", "id, name"),
  ]);
  const rows = await selectAllRows<LoanForLenderMix>(total, (from, to) =>
    supabase
      .from("loans")
      .select("loan_amount, lender_id")
      .range(from, to) as unknown as PromiseLike<{ data: LoanForLenderMix[] | null; error: unknown }>
  );

  const byLender: Record<string, { count: number; value: number }> = {};
  for (const l of rows) {
    const name = (l.lender_id && (lendersById.get(l.lender_id)?.name as string | undefined)) ?? "Unassigned";
    byLender[name] ??= { count: 0, value: 0 };
    byLender[name].count += 1;
    byLender[name].value += l.loan_amount ?? 0;
  }

  await auditPromise;

  return {
    byLender: Object.entries(byLender)
      .map(([label, v]) => ({ label, value: v.count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    totalValue: rows.reduce((s, l) => s + (l.loan_amount ?? 0), 0),
  };
}

export async function getReferralBreakdown(profile: Profile) {
  const supabase = (await createClient()) as SupabaseClient;
  const auditPromise = startAuditReportView(profile, "referral_breakdown");

  type ClientForReferral = { client_type: string | null; lead_source_id: string | null };

  const [total, leadSourcesById] = await Promise.all([
    countRows(supabase, "clients"),
    fetchLookup(supabase, "lead_sources", "id, name"),
  ]);
  const rows = await selectAllRows<ClientForReferral>(total, (from, to) =>
    supabase
      .from("clients")
      .select("client_type, lead_source_id")
      .range(from, to) as unknown as PromiseLike<{ data: ClientForReferral[] | null; error: unknown }>
  );

  const byReferral: Record<string, number> = {};
  for (const c of rows) {
    const name =
      (c.lead_source_id && (leadSourcesById.get(c.lead_source_id)?.name as string | undefined)) ??
      "Unknown / not recorded";
    byReferral[name] = (byReferral[name] ?? 0) + 1;
  }

  const byClientType: Record<string, number> = {};
  for (const c of rows) {
    const label = c.client_type ? c.client_type.replace("_", " ") : "Unclassified";
    byClientType[label] = (byClientType[label] ?? 0) + 1;
  }

  await auditPromise;

  return {
    byReferral: Object.entries(byReferral)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    byClientType: Object.entries(byClientType).map(([label, value]) => ({ label, value })),
    totalClients: rows.length,
  };
}

type LoanActivity = {
  enquiry_date: string | null;
  submission_date: string | null;
  settlement_date: string | null;
  loan_amount: number | null;
  pipeline_stage_id: string | null;
  loan_administrator_name: string | null;
  parabroker_name: string | null;
  owner_broker_id: string | null;
  broker_name_raw: string | null;
};

/**
 * One row per loan, resolved to plain display values (no ids, no lookup
 * maps) — shaped for the client-side filter/aggregate component on the
 * Pipeline page, which recomputes the monthly series in the browser as the
 * admin changes the broker/loan administrator/parabroker filters, rather
 * than round-tripping to Supabase on every filter change.
 */
export type ActivityRow = {
  enquiryDate: string | null;
  submissionDate: string | null;
  settlementDate: string | null;
  loanAmount: number | null;
  isSettled: boolean;
  broker: string;
  loanAdministrator: string;
  parabroker: string;
};

/**
 * Everything the Pipeline & Settlements page needs, from a single fetch of
 * the loans table — it used to call getPipelineOverview() and a separate
 * monthly-activity query back to back, paging through all loans twice on
 * one page load. One fetch, one audit log entry, both sets of numbers.
 */
export async function getPipelineAndActivity(profile: Profile) {
  const supabase = (await createClient()) as SupabaseClient;
  const auditPromise = startAuditReportView(profile, "pipeline_and_activity");

  const [total, stagesById, brokersById] = await Promise.all([
    countRows(supabase, "loans"),
    fetchLookup(supabase, "pipeline_stages", "id, name, category"),
    fetchLookup(supabase, "profiles", "id, full_name"),
  ]);
  const rows = await selectAllRows<LoanActivity>(total, (from, to) =>
    supabase
      .from("loans")
      .select(
        "loan_amount, enquiry_date, submission_date, settlement_date, pipeline_stage_id, loan_administrator_name, parabroker_name, owner_broker_id, broker_name_raw"
      )
      .range(from, to) as unknown as PromiseLike<{ data: LoanActivity[] | null; error: unknown }>
  );

  const categoryOf = (l: LoanActivity) =>
    l.pipeline_stage_id ? (stagesById.get(l.pipeline_stage_id)?.category as string | undefined) : undefined;
  const nameOf = (l: LoanActivity) =>
    (l.pipeline_stage_id && (stagesById.get(l.pipeline_stage_id)?.name as string | undefined)) ??
    "Unclassified";

  // Settled means "has a settlement date" — not "its status text happens to
  // be categorised as settled". A new/misspelled Status value from the
  // sheet defaults to category 'active' until someone manually recategorises
  // it (see 0003_seed_reference_data.sql), which silently hid genuinely
  // settled loans from these figures. The date is ground truth; the stage
  // category is a fallible, manually-maintained label.
  const settledCount = rows.filter((l) => l.settlement_date != null).length;
  const lostCount = rows.filter((l) => categoryOf(l) === "lost").length;
  const conversionRate =
    settledCount + lostCount > 0
      ? Math.round((settledCount / (settledCount + lostCount)) * 100)
      : 0;

  const stageCounts: Record<string, number> = {};
  for (const l of rows) {
    const name = nameOf(l);
    stageCounts[name] = (stageCounts[name] ?? 0) + 1;
  }
  const sortedStages = Object.entries(stageCounts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const topStages = sortedStages.slice(0, 5);
  const otherStagesTotal = sortedStages.slice(5).reduce((s, x) => s + x.value, 0);
  const stageBreakdown =
    otherStagesTotal > 0 ? [...topStages, { label: "Other", value: otherStagesTotal }] : topStages;

  const activityRows: ActivityRow[] = rows.map((l) => ({
    enquiryDate: l.enquiry_date,
    submissionDate: l.submission_date,
    settlementDate: l.settlement_date,
    loanAmount: l.loan_amount,
    isSettled: l.settlement_date != null,
    broker: l.owner_broker_id
      ? ((brokersById.get(l.owner_broker_id)?.full_name as string | undefined) ?? "Unknown broker")
      : l.broker_name_raw || "Unattributed",
    loanAdministrator: l.loan_administrator_name || "Unassigned",
    parabroker: l.parabroker_name || "Unassigned",
  }));

  await auditPromise;

  return {
    totalLoans: rows.length,
    settledCount,
    lostCount,
    conversionRate,
    inFlightCount: rows.length - settledCount - lostCount,
    stageBreakdown,
    activityRows,
  };
}

export type PendingSettlement = {
  clientName: string;
  lenderName: string;
  loanAmount: number | null;
  unconditionalApprovalDate: string | null;
  settlementBookedDate: string | null;
};

/**
 * Loans that are unconditionally approved but haven't actually settled yet
 * — a broker's "ready to settle" work queue. Filtered in the database
 * (not fetched-then-filtered in JS) since this is a small, targeted list,
 * not a full-table aggregate.
 */
export async function getPendingSettlements(profile: Profile): Promise<PendingSettlement[]> {
  const supabase = (await createClient()) as SupabaseClient;
  const auditPromise = startAuditReportView(profile, "pending_settlements");

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const twelveMonthsAgoISO = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
    .toISOString()
    .slice(0, 10);

  const { data } = await supabase
    .from("loans")
    .select(
      "loan_amount, unconditional_approval_date, settlement_booked_date, clients(full_name), lenders(name)"
    )
    .gte("unconditional_approval_date", twelveMonthsAgoISO) // approved in the last 12 months
    .gte("settlement_booked_date", todayISO) // booked to settle in the future (excludes no-date rows too)
    .is("settlement_date", null) // not already settled
    .order("settlement_booked_date", { ascending: true, nullsFirst: false })
    .range(0, 499);

  await auditPromise;

  type Row = {
    loan_amount: number | null;
    unconditional_approval_date: string | null;
    settlement_booked_date: string | null;
    clients: { full_name: string } | null;
    lenders: { name: string } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((r) => ({
    clientName: r.clients?.full_name ?? "Unknown client",
    lenderName: r.lenders?.name ?? "Unassigned",
    loanAmount: r.loan_amount,
    unconditionalApprovalDate: r.unconditional_approval_date,
    settlementBookedDate: r.settlement_booked_date,
  }));
}

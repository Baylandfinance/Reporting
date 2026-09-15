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
 * the book, and when" without flooding audit_log on every render.
 */
async function auditReportView(profile: Profile, report: string) {
  await logAuditEvent({
    actorId: profile.id,
    action: "view_report",
    resourceType: report,
  });
}

const PAGE_SIZE = 1000;

/**
 * Supabase's REST API caps any single request at 1,000 rows by default,
 * silently — a `.select()` on a table with 3,500 rows returns only the
 * first 1,000 with no error and no indication of truncation. Every report
 * here aggregates in JS rather than in SQL, so it must page through the
 * full result set itself rather than trusting one `.select()` to return
 * everything.
 */
async function selectAllRows<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error || !data) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

type LoanForPipeline = {
  loan_amount: number | null;
  settlement_date: string | null;
  application_date: string | null;
  pipeline_stages: { name: string; category: string } | null;
};

export async function getPipelineOverview(profile: Profile) {
  const supabase = await createClient();
  await auditReportView(profile, "pipeline_overview");

  const rows = await selectAllRows<LoanForPipeline>((from, to) =>
    (supabase as SupabaseClient)
      .from("loans")
      .select("loan_amount, settlement_date, application_date, pipeline_stages(name, category)")
      .range(from, to) as unknown as PromiseLike<{ data: LoanForPipeline[] | null; error: unknown }>
  );

  const now = new Date();
  const settledThisMonth = rows.filter((l) => {
    if (!l.settlement_date || l.pipeline_stages?.category !== "settled") return false;
    const d = new Date(l.settlement_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalPipelineValue = rows
    .filter((l) => {
      const cat = l.pipeline_stages?.category;
      return cat === "lead" || cat === "active" || cat === "on_hold";
    })
    .reduce((sum, l) => sum + (l.loan_amount ?? 0), 0);

  const settledCount = rows.filter((l) => l.pipeline_stages?.category === "settled").length;
  const lostCount = rows.filter((l) => l.pipeline_stages?.category === "lost").length;
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
    const name = l.pipeline_stages?.name ?? "Unclassified";
    stageCounts[name] = (stageCounts[name] ?? 0) + 1;
  }

  const sortedStages = Object.entries(stageCounts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const topStages = sortedStages.slice(0, 5);
  const otherStagesTotal = sortedStages.slice(5).reduce((s, x) => s + x.value, 0);
  const stageBreakdown =
    otherStagesTotal > 0 ? [...topStages, { label: "Other", value: otherStagesTotal }] : topStages;

  // Settlement value by month, last 12 months.
  const monthly: { label: string; value: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString("en-AU", { month: "short" });
    const value = rows
      .filter((l) => {
        if (!l.settlement_date || l.pipeline_stages?.category !== "settled") return false;
        const sd = new Date(l.settlement_date);
        return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
      })
      .reduce((s, l) => s + (l.loan_amount ?? 0), 0);
    monthly.push({ label, value });
  }

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
  const supabase = await createClient();
  await auditReportView(profile, "commission_summary");

  type CommissionRow = {
    upfront_commission: number | null;
    trail_commission: number | null;
    clawback_amount: number | null;
    commission_payment_date: string | null;
  };

  const rows = await selectAllRows<CommissionRow>((from, to) =>
    (supabase as SupabaseClient)
      .from("loan_commissions")
      .select("upfront_commission, trail_commission, clawback_amount, commission_payment_date")
      .range(from, to) as unknown as PromiseLike<{ data: CommissionRow[] | null; error: unknown }>
  );

  const paid = rows.filter((c) => c.commission_payment_date);
  const expected = rows.filter((c) => !c.commission_payment_date);

  const sum = (vals: (number | null)[]) => vals.reduce((s: number, v) => s + (v ?? 0), 0);

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
  const supabase = await createClient();
  await auditReportView(profile, "lender_mix");

  type LoanForLenderMix = { loan_amount: number | null; lenders: { name: string } | null };

  const rows = await selectAllRows<LoanForLenderMix>((from, to) =>
    (supabase as SupabaseClient)
      .from("loans")
      .select("loan_amount, lender_id, lenders(name)")
      .range(from, to) as unknown as PromiseLike<{ data: LoanForLenderMix[] | null; error: unknown }>
  );

  const byLender: Record<string, { count: number; value: number }> = {};
  for (const l of rows) {
    const name = l.lenders?.name ?? "Unassigned";
    byLender[name] ??= { count: 0, value: 0 };
    byLender[name].count += 1;
    byLender[name].value += l.loan_amount ?? 0;
  }

  return {
    byLender: Object.entries(byLender)
      .map(([label, v]) => ({ label, value: v.count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    totalValue: rows.reduce((s, l) => s + (l.loan_amount ?? 0), 0),
  };
}

export async function getReferralBreakdown(profile: Profile) {
  const supabase = await createClient();
  await auditReportView(profile, "referral_breakdown");

  type ClientForReferral = {
    client_type: string | null;
    lead_sources: { name: string } | null;
  };

  const rows = await selectAllRows<ClientForReferral>((from, to) =>
    (supabase as SupabaseClient)
      .from("clients")
      .select("client_type, lead_source_id, lead_sources(name)")
      .range(from, to) as unknown as PromiseLike<{ data: ClientForReferral[] | null; error: unknown }>
  );

  const byReferral: Record<string, number> = {};
  for (const c of rows) {
    const name = c.lead_sources?.name ?? "Unknown / not recorded";
    byReferral[name] = (byReferral[name] ?? 0) + 1;
  }

  const byClientType: Record<string, number> = {};
  for (const c of rows) {
    const label = c.client_type ? c.client_type.replace("_", " ") : "Unclassified";
    byClientType[label] = (byClientType[label] ?? 0) + 1;
  }

  return {
    byReferral: Object.entries(byReferral)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    byClientType: Object.entries(byClientType).map(([label, value]) => ({ label, value })),
    totalClients: rows.length,
  };
}

function isInMonth(dateStr: string | null, year: number, month: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() === month;
}

export async function getSubmissionsAndSettlements(profile: Profile) {
  const supabase = await createClient();
  await auditReportView(profile, "submissions_and_settlements");

  type LoanDates = {
    submission_date: string | null;
    settlement_booked_date: string | null;
    settlement_date: string | null;
  };

  const rows = await selectAllRows<LoanDates>((from, to) =>
    (supabase as SupabaseClient)
      .from("loans")
      .select("submission_date, settlement_booked_date, settlement_date")
      .range(from, to) as unknown as PromiseLike<{ data: LoanDates[] | null; error: unknown }>
  );

  // "Settled this month" counts a loan once even if both its booked and
  // actual settlement dates land in the same month — booked vs. settled
  // are two views of the same event, not two events.
  function settledInMonth(row: LoanDates, year: number, month: number): boolean {
    return (
      isInMonth(row.settlement_booked_date, year, month) ||
      isInMonth(row.settlement_date, year, month)
    );
  }

  const now = new Date();
  const submissionsThisMonth = rows.filter((r) =>
    isInMonth(r.submission_date, now.getFullYear(), now.getMonth())
  ).length;
  const settlementsThisMonth = rows.filter((r) =>
    settledInMonth(r, now.getFullYear(), now.getMonth())
  ).length;

  const monthly: { label: string; submissions: number; settlements: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString("en-AU", { month: "short" });
    const submissions = rows.filter((r) =>
      isInMonth(r.submission_date, d.getFullYear(), d.getMonth())
    ).length;
    const settlements = rows.filter((r) => settledInMonth(r, d.getFullYear(), d.getMonth())).length;
    monthly.push({ label, submissions, settlements });
  }

  return { submissionsThisMonth, settlementsThisMonth, monthly };
}

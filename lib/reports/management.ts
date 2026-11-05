import {
  ANNUAL_GOAL,
  EXCLUDED_STATUSES,
  FY_START_MONTH,
  LEAD_MAX_AGE_MONTHS,
  STAGE_LABELS,
  STAGE_ORDER,
  STAGE_WEIGHTING,
  STATUS_TO_STAGE,
  TEAM_ORDER,
  attributeTeam,
  type PipelineStage,
  type TeamAttribution,
  type TeamKey,
} from "./management-config";

/**
 * Pure calculation for the Team Performance and Average Loan Size reports:
 * loan rows in, report figures out, no database access. Kept pure so the
 * same code path renders the real pages and the dev-only dummy-data
 * preview, and so its arithmetic can be checked against the specification.
 *
 * Every loan lands in exactly one reconciliation bucket, so the buckets
 * always sum to the number of loans read — nothing is dropped silently.
 */

export type ManagementLoanRow = {
  id: string;
  broker_name_raw: string | null;
  loan_administrator_name: string | null;
  /** Pipeline stage name (the sheet's Status), or null if none. */
  status: string | null;
  loan_amount: number | null;
  enquiry_date: string | null;
  quote_date: string | null;
  application_date: string | null;
  submission_date: string | null;
  settlement_date: string | null;
};

export type ColumnKey = TeamKey | "Company";
export const COLUMN_ORDER: ColumnKey[] = [...TEAM_ORDER, "Company"];

export type MonthRef = { key: string; label: string };

export type ValueCount = {
  /** Sum of loan amounts (missing amounts contribute nothing). */
  value: number;
  /** Number of loans, including ones with no amount. */
  count: number;
  /** Loans that have an amount — the denominator for average loan size. */
  countWithAmount: number;
};

export type TeamFigures = {
  annualGoal: number | null;
  ytdGoal: number | null;
  settledYtd: ValueCount;
  stages: Record<PipelineStage, ValueCount>;
  weightedPipelineValue: number;
  weightedPipelineCount: number;
  forecastValue: number;
  forecastCount: number;
  /** Per month, in `months` order. */
  monthly: {
    newLeads: number;
    submissions: number;
    settled: ValueCount;
  }[];
};

export type ReconciliationLine = { label: string; count: number; inReport: boolean };

export type ManagementReport = {
  reportMonth: MonthRef;
  financialYearLabel: string;
  monthsElapsed: number;
  months: MonthRef[];
  leadCutoffLabel: string;
  totalLoansInDatabase: number;
  loansRead: number;
  columns: Record<ColumnKey, TeamFigures>;
  reconciliation: ReconciliationLine[];
  attribution: { label: string; count: number }[];
};

// Fixed abbreviations: Intl's en-AU short months vary by runtime ("Sept", "July").
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });

function monthKey(year: number, monthIndex: number): string {
  const d = new Date(Date.UTC(year, monthIndex, 1));
  return d.toISOString().slice(0, 7);
}

function monthRef(year: number, monthIndex: number, long = false): MonthRef {
  const d = new Date(Date.UTC(year, monthIndex, 1));
  const label = long
    ? MONTH_LONG.format(d)
    : `${MONTH_ABBR[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`;
  return { key: monthKey(year, monthIndex), label };
}

/** Parses "YYYY-MM" (from the URL) — falls back to the last completed month. */
export function resolveReportMonth(param: string | undefined, today = new Date()): { year: number; monthIndex: number } {
  const match = param?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    if (monthIndex >= 0 && monthIndex <= 11 && year >= 2000 && year <= 2100) return { year, monthIndex };
  }
  const lastCompleted = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  return { year: lastCompleted.getUTCFullYear(), monthIndex: lastCompleted.getUTCMonth() };
}

/** Months available in the picker: every month of the current and previous financial year up to now. */
export function selectableMonths(today = new Date()): MonthRef[] {
  const out: MonthRef[] = [];
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const fyStartYear = today.getUTCMonth() >= FY_START_MONTH ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
  const start = new Date(Date.UTC(fyStartYear - 1, FY_START_MONTH, 1));
  for (let d = end; d >= start; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))) {
    out.push(monthRef(d.getUTCFullYear(), d.getUTCMonth(), true));
  }
  return out;
}

function emptyValueCount(): ValueCount {
  return { value: 0, count: 0, countWithAmount: 0 };
}

function add(vc: ValueCount, amount: number | null) {
  vc.count += 1;
  if (amount != null) {
    vc.value += amount;
    vc.countWithAmount += 1;
  }
}

function emptyFigures(monthCount: number, annualGoal: number | null): TeamFigures {
  return {
    annualGoal,
    ytdGoal: null,
    settledYtd: emptyValueCount(),
    stages: {
      approved: emptyValueCount(),
      submitted: emptyValueCount(),
      planned: emptyValueCount(),
      leads: emptyValueCount(),
    },
    weightedPipelineValue: 0,
    weightedPipelineCount: 0,
    forecastValue: 0,
    forecastCount: 0,
    monthly: Array.from({ length: monthCount }, () => ({ newLeads: 0, submissions: 0, settled: emptyValueCount() })),
  };
}

function earliestDate(row: ManagementLoanRow): string | null {
  const dates = [row.enquiry_date, row.quote_date, row.application_date].filter((d): d is string => !!d);
  return dates.sort()[0] ?? null;
}

/** Average loan size, or null when nothing with an amount was recorded (shown as "–"). */
export function averageOf(vc: ValueCount): number | null {
  return vc.countWithAmount > 0 ? vc.value / vc.countWithAmount : null;
}

export function buildManagementReport(
  rows: ManagementLoanRow[],
  totalLoansInDatabase: number,
  report: { year: number; monthIndex: number }
): ManagementReport {
  const fyStartYear = report.monthIndex >= FY_START_MONTH ? report.year : report.year - 1;
  const months: MonthRef[] = [];
  for (let i = 0; ; i++) {
    const d = new Date(Date.UTC(fyStartYear, FY_START_MONTH + i, 1));
    months.push(monthRef(d.getUTCFullYear(), d.getUTCMonth()));
    if (d.getUTCFullYear() === report.year && d.getUTCMonth() === report.monthIndex) break;
  }
  const monthIndexByKey = new Map(months.map((m, i) => [m.key, i]));
  const fyStart = `${monthKey(fyStartYear, FY_START_MONTH)}-01`;
  // Last calendar day of the report month, as an ISO date string.
  const reportEnd = new Date(Date.UTC(report.year, report.monthIndex + 1, 0)).toISOString().slice(0, 10);
  const leadCutoffDate = new Date(Date.UTC(report.year, report.monthIndex - (LEAD_MAX_AGE_MONTHS - 1), 1));
  const leadCutoff = leadCutoffDate.toISOString().slice(0, 10);
  const reportMonth = monthRef(report.year, report.monthIndex, true);

  const columns = Object.fromEntries(
    COLUMN_ORDER.map((c) => [
      c,
      emptyFigures(
        months.length,
        c === "Company" ? TEAM_ORDER.reduce((s, t) => s + (ANNUAL_GOAL[t] ?? 0), 0) : ANNUAL_GOAL[c]
      ),
    ])
  ) as Record<ColumnKey, TeamFigures>;

  const buckets = new Map<string, ReconciliationLine>();
  const bucket = (label: string, inReport: boolean) => {
    const line = buckets.get(label) ?? { label, count: 0, inReport };
    line.count += 1;
    buckets.set(label, line);
  };

  const attributionCounts = new Map<TeamAttribution["reason"], number>();

  for (const row of rows) {
    const { team, reason } = attributeTeam(row.broker_name_raw, row.loan_administrator_name);
    attributionCounts.set(reason, (attributionCounts.get(reason) ?? 0) + 1);
    const targets = [columns[team], columns.Company];

    // Monthly activity — by date, independent of current status.
    const leadDate = earliestDate(row);
    const leadMonth = leadDate ? monthIndexByKey.get(leadDate.slice(0, 7)) : undefined;
    const submissionMonth = row.submission_date ? monthIndexByKey.get(row.submission_date.slice(0, 7)) : undefined;
    for (const t of targets) {
      if (leadMonth !== undefined) t.monthly[leadMonth]!.newLeads += 1;
      if (submissionMonth !== undefined) t.monthly[submissionMonth]!.submissions += 1;
    }

    // Where the loan sits — exactly one bucket each.
    if (row.settlement_date) {
      if (row.settlement_date < fyStart) {
        bucket("Settled before this financial year", false);
      } else if (row.settlement_date > reportEnd) {
        bucket(`Settled after ${reportMonth.label}`, false);
      } else {
        bucket(`Settled this financial year, to end of ${reportMonth.label}`, true);
        const settledMonth = monthIndexByKey.get(row.settlement_date.slice(0, 7))!;
        for (const t of targets) {
          add(t.settledYtd, row.loan_amount);
          add(t.monthly[settledMonth]!.settled, row.loan_amount);
        }
      }
      continue;
    }

    const status = (row.status ?? "").trim().toLowerCase();
    if (!status) {
      bucket("No status recorded", false);
      continue;
    }
    if (status === "settled") {
      bucket("Marked Settled but no settlement date", false);
      continue;
    }
    if (EXCLUDED_STATUSES[status]) {
      bucket(EXCLUDED_STATUSES[status], false);
      continue;
    }
    const stage = STATUS_TO_STAGE[status];
    if (!stage) {
      bucket(`Status not mapped to a stage: "${row.status}"`, false);
      continue;
    }
    if (stage === "leads" && (!leadDate || leadDate < leadCutoff)) {
      bucket(`Lead older than ${LEAD_MAX_AGE_MONTHS} months, or undated`, false);
      continue;
    }
    bucket(`In pipeline – ${stage}`, true);
    for (const t of targets) add(t.stages[stage], row.loan_amount);
  }

  for (const c of COLUMN_ORDER) {
    const f = columns[c];
    f.ytdGoal = f.annualGoal != null ? (f.annualGoal * months.length) / 12 : null;
    for (const s of STAGE_ORDER) {
      f.weightedPipelineValue += f.stages[s].value * STAGE_WEIGHTING[s];
      f.weightedPipelineCount += f.stages[s].count * STAGE_WEIGHTING[s];
    }
    f.forecastValue = f.settledYtd.value + f.weightedPipelineValue;
    f.forecastCount = f.settledYtd.count + f.weightedPipelineCount;
  }

  const ATTRIBUTION_LABELS: Record<TeamAttribution["reason"], string> = {
    team_broker: "Broker is a team member",
    david_assigned_to_team: "David's deal, Sam or Ben assigned as Loan Administrator",
    david_alone: "David's deal, no team member assigned",
    past_staff_or_blank: "Past staff or blank Broker, counted as David's",
  };

  const stageBucketLabel = (s: PipelineStage) => `In pipeline – ${s}`;
  const reconciliation = [...buckets.values()]
    .map((line) => {
      const stage = STAGE_ORDER.find((s) => line.label === stageBucketLabel(s));
      return stage ? { ...line, label: `In pipeline: ${STAGE_LABELS[stage]}` } : line;
    })
    .sort((a, b) => Number(b.inReport) - Number(a.inReport) || b.count - a.count);

  return {
    reportMonth,
    financialYearLabel: `FY ${fyStartYear}–${String(fyStartYear + 1).slice(2)}`,
    monthsElapsed: months.length,
    months,
    leadCutoffLabel: monthRef(leadCutoffDate.getUTCFullYear(), leadCutoffDate.getUTCMonth(), true).label,
    totalLoansInDatabase,
    loansRead: rows.length,
    columns,
    reconciliation,
    attribution: (Object.keys(ATTRIBUTION_LABELS) as TeamAttribution["reason"][]).map((r) => ({
      label: ATTRIBUTION_LABELS[r],
      count: attributionCounts.get(r) ?? 0,
    })),
  };
}

import {
  CATEGORY_ORDER,
  LEADS_WINDOW_MONTHS,
  LEAD_TYPES,
  OTHER_REFERRERS,
  SOURCE_GROUP_ORDER,
  classifyLeadSource,
  classifyLeadType,
  type LeadCategory,
  type SourceGroup,
} from "./leads-config";
import type { MonthRef, ReconciliationLine } from "./management";

/**
 * Pure calculation for the Leads & Marketing report: one loan row = one
 * lead, dated by its earliest recorded date (Enquiry, falling back to
 * Quote then Application — the same rule as loan matching). Every row
 * lands in exactly one reconciliation line, so nothing drops out unseen.
 */

export type LeadRow = {
  transaction_type_raw: string | null;
  /** The client's Lead Origination name, or null. */
  lead_source: string | null;
  enquiry_date: string | null;
  quote_date: string | null;
  application_date: string | null;
};

export type CountLine = { label: string; monthly: number[]; total: number };

export type MappingLine = { raw: string; mappedTo: string; count: number };

export type LeadsReport = {
  reportMonth: MonthRef;
  months: MonthRef[];
  totalLeads: number;
  monthlyTotals: number[];
  categories: (CountLine & { category: LeadCategory })[];
  typesByCategory: { category: LeadCategory; lines: CountLine[]; subtotal: CountLine }[];
  sourcesByGroup: { group: SourceGroup; lines: CountLine[]; subtotal: CountLine }[];
  /** Lead type × source group, for the report month and for the whole window. */
  crossTab: { month: Record<string, Record<SourceGroup, number>>; window: Record<string, Record<SourceGroup, number>> };
  reconciliation: ReconciliationLine[];
  totalLoansInDatabase: number;
  loansRead: number;
  typeMapping: MappingLine[];
  sourceMapping: MappingLine[];
};

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });

function earliest(row: LeadRow): string | null {
  return [row.enquiry_date, row.quote_date, row.application_date].filter((d): d is string => !!d).sort()[0] ?? null;
}

function line(label: string, n: number): CountLine {
  return { label, monthly: Array.from({ length: n }, () => 0), total: 0 };
}

function bump(l: CountLine, i: number) {
  l.monthly[i] = (l.monthly[i] ?? 0) + 1;
  l.total += 1;
}

function sumLines(label: string, lines: CountLine[], n: number): CountLine {
  const out = line(label, n);
  for (const l of lines) {
    l.monthly.forEach((v, i) => (out.monthly[i] = (out.monthly[i] ?? 0) + v));
    out.total += l.total;
  }
  return out;
}

function emptyGroups(): Record<SourceGroup, number> {
  return Object.fromEntries(SOURCE_GROUP_ORDER.map((g) => [g, 0])) as Record<SourceGroup, number>;
}

export function buildLeadsReport(
  rows: LeadRow[],
  totalLoansInDatabase: number,
  report: { year: number; monthIndex: number }
): LeadsReport {
  const months: MonthRef[] = [];
  for (let i = LEADS_WINDOW_MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(report.year, report.monthIndex - i, 1));
    months.push({
      key: d.toISOString().slice(0, 7),
      label: `${MONTH_ABBR[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`,
    });
  }
  const n = months.length;
  const monthIndexByKey = new Map(months.map((m, i) => [m.key, i]));
  const firstKey = months[0]!.key;
  const lastKey = months[n - 1]!.key;
  const reportMonth: MonthRef = {
    key: lastKey,
    label: MONTH_LONG.format(new Date(Date.UTC(report.year, report.monthIndex, 1))),
  };

  const typeLines = new Map(LEAD_TYPES.map((t) => [t.key, line(t.label, n)]));
  const sourceLines = new Map<string, { group: SourceGroup; line: CountLine }>();
  const monthlyTotals = Array.from({ length: n }, () => 0);
  const crossMonth: Record<string, Record<SourceGroup, number>> = {};
  const crossWindow: Record<string, Record<SourceGroup, number>> = {};
  const typeMapping = new Map<string, MappingLine>();
  const sourceMapping = new Map<string, MappingLine>();
  const buckets = { inWindow: 0, before: 0, after: 0, undated: 0 };

  for (const row of rows) {
    const date = earliest(row);
    if (!date) {
      buckets.undated += 1;
      continue;
    }
    const key = date.slice(0, 7);
    if (key < firstKey) {
      buckets.before += 1;
      continue;
    }
    if (key > lastKey) {
      buckets.after += 1;
      continue;
    }
    buckets.inWindow += 1;
    const mi = monthIndexByKey.get(key)!;
    monthlyTotals[mi] = (monthlyTotals[mi] ?? 0) + 1;

    const typeKey = classifyLeadType(row.transaction_type_raw);
    const typeLabel = LEAD_TYPES.find((t) => t.key === typeKey)!.label;
    bump(typeLines.get(typeKey)!, mi);

    const src = classifyLeadSource(row.lead_source);
    const srcEntry = sourceLines.get(src.line) ?? { group: src.group, line: line(src.line, n) };
    bump(srcEntry.line, mi);
    sourceLines.set(src.line, srcEntry);

    (crossWindow[typeLabel] ??= emptyGroups())[src.group] += 1;
    if (mi === n - 1) (crossMonth[typeLabel] ??= emptyGroups())[src.group] += 1;

    const rawType = row.transaction_type_raw?.trim() || "(blank)";
    const tm = typeMapping.get(rawType) ?? { raw: rawType, mappedTo: typeLabel, count: 0 };
    tm.count += 1;
    typeMapping.set(rawType, tm);
    const rawSource = row.lead_source?.trim() || "(blank)";
    const sm = sourceMapping.get(rawSource) ?? { raw: rawSource, mappedTo: src.line, count: 0 };
    sm.count += 1;
    sourceMapping.set(rawSource, sm);
  }

  const typesByCategory = CATEGORY_ORDER.map((category) => {
    const lines = LEAD_TYPES.filter((t) => t.category === category).map((t) => typeLines.get(t.key)!);
    return { category, lines, subtotal: sumLines(`${category} subtotal`, lines, n) };
  });

  const sourcesByGroup = SOURCE_GROUP_ORDER.map((group) => {
    const lines = [...sourceLines.values()]
      .filter((s) => s.group === group)
      .map((s) => s.line)
      // Named partners by size, "Other referrers" always last within its group.
      .sort((a, b) => Number(a.label === OTHER_REFERRERS) - Number(b.label === OTHER_REFERRERS) || b.total - a.total);
    return { group, lines, subtotal: sumLines(`${group} subtotal`, lines, n) };
  }).filter((g) => g.subtotal.total > 0 || g.group !== "Unallocated");

  const window = `${months[0]!.label} to ${months[n - 1]!.label}`;
  const reconciliation: ReconciliationLine[] = [
    { label: `Leads first recorded ${window}`, count: buckets.inWindow, inReport: true },
    { label: `First recorded before ${months[0]!.label}`, count: buckets.before, inReport: false },
    { label: `First recorded after ${months[n - 1]!.label}`, count: buckets.after, inReport: false },
    { label: "No enquiry, quote or application date", count: buckets.undated, inReport: false },
  ];

  return {
    reportMonth,
    months,
    totalLeads: buckets.inWindow,
    monthlyTotals,
    categories: typesByCategory.map((c) => ({ ...c.subtotal, label: c.category, category: c.category })),
    typesByCategory,
    sourcesByGroup,
    crossTab: { month: crossMonth, window: crossWindow },
    reconciliation,
    totalLoansInDatabase,
    loansRead: rows.length,
    typeMapping: [...typeMapping.values()].sort((a, b) => b.count - a.count),
    sourceMapping: [...sourceMapping.values()].sort((a, b) => b.count - a.count),
  };
}

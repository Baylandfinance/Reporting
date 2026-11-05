import type { ManagementLoanRow } from "@/lib/reports/management";

/**
 * PREVIEW ONLY — synthetic loan rows that reproduce the Broker Team
 * Performance specification's dummy figures at 31 Oct 2026 (settlements by
 * month, pipeline gross and counts by stage), plus a handful of rows in
 * each excluded bucket so the reconciliation table has something to show.
 * Contains no real client data.
 */

let seq = 0;
function row(partial: Partial<ManagementLoanRow>): ManagementLoanRow {
  seq += 1;
  return {
    id: `dummy-${seq}`,
    broker_name_raw: null,
    loan_administrator_name: null,
    status: null,
    loan_amount: null,
    enquiry_date: null,
    quote_date: null,
    application_date: null,
    submission_date: null,
    settlement_date: null,
    ...partial,
  };
}

/** Splits a total across n loans so they sum back exactly (to the cent). */
function split(total: number, n: number): number[] {
  const base = Math.floor((total / n) * 100) / 100;
  const out = Array.from({ length: n }, () => base);
  out[n - 1] = Math.round((total - base * (n - 1)) * 100) / 100;
  return out;
}

// Alternate between a team member's own deal and David's deal with the
// team leader as Loan Administrator, to exercise both attribution paths.
function teamOwner(team: "S" | "B", i: number) {
  const leader = team === "S" ? "Sam" : "Ben";
  return i % 2 === 0
    ? { broker_name_raw: leader, loan_administrator_name: leader }
    : { broker_name_raw: "David Fraser", loan_administrator_name: leader };
}

const MONTHS = ["2026-07", "2026-08", "2026-09", "2026-10"];

const SETTLED: Record<"S" | "B", { counts: number[]; values: number[] }> = {
  S: { counts: [2, 3, 3, 3], values: [2.4e6, 3.0e6, 3.8e6, 4.5e6] },
  B: { counts: [3, 4, 5, 5], values: [2.2e6, 2.8e6, 3.2e6, 4.0e6] },
};

const STAGES: { status: string; S: [number, number]; B: [number, number] }[] = [
  { status: "Unconditional", S: [9, 6.1e6], B: [13, 10.0e6] },
  { status: "Submitted", S: [14, 14.5e6], B: [21, 21.5e6] },
  { status: "Planned submission", S: [16, 7.3e6], B: [25, 30.9e6] },
  { status: "Active", S: [18, 25.0e6], B: [27, 20.0e6] },
];

export function buildDummyRows(): ManagementLoanRow[] {
  seq = 0;
  const rows: ManagementLoanRow[] = [];

  for (const team of ["S", "B"] as const) {
    MONTHS.forEach((m, mi) => {
      split(SETTLED[team].values[mi]!, SETTLED[team].counts[mi]!).forEach((amount, i) => {
        rows.push(
          row({
            ...teamOwner(team, i),
            status: "Settled",
            loan_amount: amount,
            enquiry_date: "2026-03-10",
            submission_date: "2026-05-20",
            settlement_date: `${m}-${String(10 + i).padStart(2, "0")}`,
          })
        );
      });
    });

    for (const stage of STAGES) {
      const [count, gross] = stage[team];
      split(gross, count).forEach((amount, i) => {
        rows.push(
          row({
            ...teamOwner(team, i),
            status: stage.status,
            loan_amount: amount,
            enquiry_date: `${MONTHS[i % 4]}-0${1 + (i % 8)}`,
            submission_date: stage.status === "Unconditional" || stage.status === "Submitted" ? `${MONTHS[i % 4]}-15` : null,
          })
        );
      });
    }
  }

  // Excluded buckets, to show the reconciliation working.
  for (let i = 0; i < 12; i++) rows.push(row({ ...teamOwner("B", i), status: "Hold", loan_amount: 500_000, enquiry_date: "2025-11-02" }));
  for (let i = 0; i < 20; i++) rows.push(row({ ...teamOwner("S", i), status: "Lost", loan_amount: 400_000, enquiry_date: "2026-08-04" }));
  for (let i = 0; i < 30; i++) rows.push(row({ ...teamOwner("B", i), status: "Settled", loan_amount: 650_000, settlement_date: "2025-09-12" }));
  for (let i = 0; i < 3; i++) rows.push(row({ ...teamOwner("S", i), status: "Settled", loan_amount: 700_000 }));
  for (let i = 0; i < 5; i++) rows.push(row({ broker_name_raw: "Madi", status: "Active", enquiry_date: "2024-02-01" }));
  for (let i = 0; i < 2; i++) rows.push(row({ broker_name_raw: "David Fraser", status: "Pricing", enquiry_date: "2026-09-01" }));

  return rows;
}

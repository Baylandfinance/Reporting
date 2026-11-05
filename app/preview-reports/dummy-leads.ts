import type { LeadRow } from "@/lib/reports/leads";

/**
 * PREVIEW ONLY — synthetic lead rows reproducing the Leads Marketing
 * specification's dummy data (the one-month source × type split, repeated
 * Jan–Oct 2026 = 45 leads a month). Uses spreadsheet-style free text so the
 * classification rules are exercised too. No real client data.
 */

const SOURCES = ["Existing client", "Keeping clients", "Modi", "Property Advocate", "BNI", "Real Estate Agent", "Phone enquiry", "Website"];

// [Transaction Type text, counts per source in SOURCES order] — from the spec's section 4.
const SPLIT: [string, number[]][] = [
  ["FHB Purchase", [1, 0, 1, 1, 0, 5, 2, 3]],
  ["OO Purchase", [1, 0, 0, 2, 0, 0, 1, 1]],
  ["OO Refinance", [3, 3, 1, 0, 1, 0, 1, 1]],
  ["Investment purchase", [1, 1, 1, 2, 0, 0, 0, 0]],
  ["Investment refinance", [1, 1, 0, 0, 0, 0, 0, 0]],
  ["Commercial purchase", [0, 0, 0, 0, 1, 0, 0, 0]],
  ["Business purchase", [0, 0, 0, 0, 1, 0, 0, 0]],
  ["SMSF commercial purchase", [0, 0, 2, 0, 0, 0, 0, 0]],
  ["SMSF refinance", [0, 2, 0, 0, 0, 0, 0, 0]],
  ["Car loan", [0, 0, 0, 0, 1, 0, 0, 0]],
  ["Cashflow loan", [0, 0, 0, 0, 1, 0, 0, 0]],
  ["Personal loan", [0, 0, 0, 0, 0, 0, 1, 0]],
  ["Business advisory", [1, 0, 0, 0, 0, 0, 0, 0]],
];

export function buildDummyLeadRows(): LeadRow[] {
  const rows: LeadRow[] = [];
  for (let m = 1; m <= 10; m++) {
    const month = `2026-${String(m).padStart(2, "0")}`;
    for (const [type, counts] of SPLIT) {
      counts.forEach((n, si) => {
        for (let i = 0; i < n; i++) {
          rows.push({
            transaction_type_raw: type,
            lead_source: SOURCES[si]!,
            enquiry_date: `${month}-${String(1 + ((i + si) % 27)).padStart(2, "0")}`,
            quote_date: null,
            application_date: null,
          });
        }
      });
    }
  }
  // Outside the window or undated — reconciliation only.
  for (let i = 0; i < 25; i++) rows.push({ transaction_type_raw: "Purchase", lead_source: null, enquiry_date: "2025-06-03", quote_date: null, application_date: null });
  for (let i = 0; i < 4; i++) rows.push({ transaction_type_raw: "Pricing", lead_source: null, enquiry_date: null, quote_date: null, application_date: null });
  return rows;
}

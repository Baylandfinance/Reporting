/**
 * Classification rules for the Leads & Marketing report, mapping the
 * spreadsheet's free-text "Transaction Type" and "Lead Origination" columns
 * onto the specification's lead types and lead sources.
 *
 * The source columns aren't controlled lists (600+ distinct Transaction
 * Type values), so this is keyword matching, not a lookup. Two honest
 * limits, both shown on the page rather than guessed around:
 * - A plain "Purchase" or "Refinance" doesn't say owner-occupied vs
 *   investment, so those get their own "not recorded" lines.
 * - Anything unrecognisable is "Unallocated", per the specification.
 * The page lists every raw value and where it went, so misfiles are
 * visible and the rules here can be corrected.
 */

export type LeadCategory = "Residential" | "Commercial" | "Asset Finance" | "Personal Loans" | "Business Advisory" | "Unallocated";

export const CATEGORY_ORDER: LeadCategory[] = [
  "Residential",
  "Commercial",
  "Asset Finance",
  "Personal Loans",
  "Business Advisory",
  "Unallocated",
];

export type LeadTypeLine = { key: string; label: string; category: LeadCategory };

export const LEAD_TYPES: LeadTypeLine[] = [
  { key: "fhb", label: "First Home Buyers", category: "Residential" },
  { key: "oo_purchase", label: "OO Purchases", category: "Residential" },
  { key: "oo_refi", label: "OO Refinances", category: "Residential" },
  { key: "inv_purchase", label: "Inv Purchases", category: "Residential" },
  { key: "inv_refi", label: "Inv Refinances", category: "Residential" },
  { key: "res_purchase", label: "Purchases – OO/Inv not recorded", category: "Residential" },
  { key: "res_refi", label: "Refinances – OO/Inv not recorded", category: "Residential" },
  { key: "com_purchase", label: "Commercial Purchases", category: "Commercial" },
  { key: "bus_purchase", label: "Business Purchases", category: "Commercial" },
  { key: "com_refi", label: "Commercial Refinances", category: "Commercial" },
  { key: "smsf_purchase", label: "Commercial SMSF Purchases", category: "Commercial" },
  { key: "smsf_refi", label: "Commercial SMSF Refinances", category: "Commercial" },
  { key: "com_other", label: "Commercial – type not recorded", category: "Commercial" },
  { key: "motor", label: "Motor Vehicle Finance", category: "Asset Finance" },
  { key: "plant", label: "Plant and Equipment", category: "Asset Finance" },
  { key: "cashflow", label: "Cashflow Loan", category: "Asset Finance" },
  { key: "personal", label: "Personal Loans", category: "Personal Loans" },
  { key: "advisory", label: "Business Advisory", category: "Business Advisory" },
  { key: "unallocated", label: "Unallocated", category: "Unallocated" },
];

const has = (s: string, re: RegExp) => re.test(s);
const REFI = /\b(refi|refinanc\w*|top ?up|cash ?out|equity|debt consol\w*|switch\w*|restructur\w*)\b/;
const PURCHASE = /\b(purchas\w*|buy\w*|construct\w*|build\w*|land|bridging|pre ?-?approv\w*|off the plan)\b/;

/** Transaction Type text → lead type key. */
export function classifyLeadType(raw: string | null): string {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "unallocated";

  if (has(s, /\b(fhb|first home\w*)\b/)) return "fhb";
  if (has(s, /\bsmsf\b/)) return has(s, REFI) ? "smsf_refi" : "smsf_purchase";
  if (has(s, /\b(business|bus)\s+(purchas\w*|acqui\w*)|\b(buy\w*|purchas\w*)\s+(a\s+)?business\b/)) return "bus_purchase";
  if (has(s, /\b(car|cars|vehicle\w*|motor\w*|ute|auto)\b/)) return "motor";
  if (has(s, /\b(equipment|plant|truck\w*|machiner\w*|chattel\w*)\b/)) return "plant";
  if (has(s, /\b(cash ?flow|overdraft|working capital|invoice financ\w*)\b/)) return "cashflow";
  if (has(s, /\bpersonal\b/)) return "personal";
  if (has(s, /\badvis\w*\b/)) return "advisory";
  // Deliberately not "office"/"retail": the sheet has notes like "new
  // eview office to call" in this column.
  if (has(s, /\b(commercial|industrial|warehouse|business)\b/)) {
    if (has(s, REFI)) return "com_refi";
    if (has(s, PURCHASE)) return "com_purchase";
    return "com_other";
  }
  if (has(s, /\b(inv|invest\w*)\b/)) return has(s, REFI) ? "inv_refi" : "inv_purchase";
  if (has(s, /\b(oo|o\/o|owner ?occ\w*)\b/)) return has(s, REFI) ? "oo_refi" : "oo_purchase";
  if (has(s, REFI)) return "res_refi";
  if (has(s, PURCHASE)) return "res_purchase";
  return "unallocated";
}

export type SourceGroup = "Existing client" | "Referral partner" | "New phone enquiry" | "Online enquiry" | "Unallocated";

export const SOURCE_GROUP_ORDER: SourceGroup[] = [
  "Existing client",
  "Referral partner",
  "New phone enquiry",
  "Online enquiry",
  "Unallocated",
];

/**
 * Named referral partners reported on their own line (lower-cased sheet
 * value → display name). Anything else that isn't an existing-client,
 * phone or online value counts under "Other referrers" — mostly individual
 * people's names in the source sheet. Add a partner here to give it its
 * own line.
 */
const REFERRAL_PARTNERS: Record<string, string> = {
  eview: "Eview",
  bni: "BNI",
  vinnie: "Vinnie",
  mjc: "MJC",
  mint: "Mint",
  mlb: "MLB",
  modi: "Modi",
  "mortgage buddy": "Mortgage Buddy",
  stryd: "Stryd",
  nexia: "Nexia",
  "fox partners": "Fox Partners",
  fintik: "Fintik",
  "aussie tas": "Aussie TAS",
  "agents agency": "Agents Agency",
  sos: "SOS",
  impact: "Impact",
  "property advocate": "Property Advocate",
  "real estate agent": "Real Estate Agent",
};

export const OTHER_REFERRERS = "Other referrers";

/** Lead Origination text → { group, line }. */
export function classifyLeadSource(raw: string | null): { group: SourceGroup; line: string } {
  const s = (raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return { group: "Unallocated", line: "Unallocated" };
  // Assumption to confirm: "Keeping clients" is the broker calling the
  // client back (broker initiated); "Existing client" is the client coming
  // back on their own (client initiated).
  if (s.startsWith("keeping client")) return { group: "Existing client", line: "Existing client – broker initiated" };
  if (/\b(existing|repeat|returning)\b/.test(s)) return { group: "Existing client", line: "Existing client – client initiated" };
  if (/\b(phone|call|walk ?in)\b/.test(s)) return { group: "New phone enquiry", line: "New phone enquiry" };
  if (/\b(website|web|online|google|squarespace|facebook|instagram|social|seo|internet)\b/.test(s)) {
    return { group: "Online enquiry", line: "Online enquiry" };
  }
  const partner = REFERRAL_PARTNERS[s];
  return { group: "Referral partner", line: partner ?? OTHER_REFERRERS };
}

/** Rolling window, per the specification. */
export const LEADS_WINDOW_MONTHS = 10;

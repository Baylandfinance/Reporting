/**
 * Business rules for the Management reports (Team Performance, Average
 * Loan Size), agreed with the business owner. Kept in one file so a team
 * change, a new goal or a re-weighting is a one-line edit here rather than
 * a hunt through the report logic.
 *
 * Names are matched case-insensitively against the spreadsheet's free-text
 * "Broker" and "Loan Administrator" columns (first name or full name).
 */

export type TeamKey = "S" | "B" | "David";

export const TEAM_LABELS: Record<TeamKey, string> = {
  S: "Team S",
  B: "Team B",
  David: "David",
};

/** Report column order. Company = sum of all three. */
export const TEAM_ORDER: TeamKey[] = ["S", "B", "David"];

/**
 * Team membership by name as it appears in the sheet. Former members stay
 * listed so their historical loans keep counting for the team they were
 * in (e.g. Pat, previously in Ben's team). "Sar" is a recurring typo for
 * Sam in the source sheet.
 */
const TEAM_MEMBERS: Record<"S" | "B", string[]> = {
  S: ["sam", "sar", "jordan", "ju"],
  B: ["ben", "rahdine", "tharini", "pat"],
};

const DAVID_NAMES = ["david", "david fraser"];

function normalise(name: string | null): string {
  return (name ?? "").trim().toLowerCase();
}

function teamOfMember(name: string | null): "S" | "B" | null {
  const n = normalise(name);
  if (!n) return null;
  const first = n.split(/\s+/)[0] ?? n;
  for (const team of ["S", "B"] as const) {
    if (TEAM_MEMBERS[team].includes(n) || TEAM_MEMBERS[team].includes(first)) return team;
  }
  return null;
}

export type TeamAttribution = {
  team: TeamKey;
  /** Why the loan landed in that team — surfaced in the reconciliation table. */
  reason: "team_broker" | "david_assigned_to_team" | "david_alone" | "past_staff_or_blank";
};

/**
 * - Broker is a team member → that team.
 * - Broker is David and the Loan Administrator is a team member (in
 *   practice Sam or Ben) → that team: they processed it.
 * - Broker is David with nobody from a team assigned → David.
 * - Anyone else (past staff, or a blank Broker) → David, flagged so it's
 *   visible rather than silently absorbed.
 */
export function attributeTeam(brokerName: string | null, loanAdministratorName: string | null): TeamAttribution {
  const brokerTeam = teamOfMember(brokerName);
  if (brokerTeam) return { team: brokerTeam, reason: "team_broker" };

  if (DAVID_NAMES.includes(normalise(brokerName))) {
    const assigned = teamOfMember(loanAdministratorName);
    return assigned
      ? { team: assigned, reason: "david_assigned_to_team" }
      : { team: "David", reason: "david_alone" };
  }

  return { team: "David", reason: "past_staff_or_blank" };
}

/** Settlement goal for the financial year, in dollars. David has none. */
export const ANNUAL_GOAL: Record<TeamKey, number | null> = {
  S: 60_000_000,
  B: 60_000_000,
  David: null,
};

/** Financial year starts in July (month index 6). */
export const FY_START_MONTH = 6;

export type PipelineStage = "approved" | "submitted" | "planned" | "leads";

export const STAGE_ORDER: PipelineStage[] = ["approved", "submitted", "planned", "leads"];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  approved: "Approved to be settled",
  submitted: "Submitted – awaiting approval",
  planned: "Planned submissions",
  leads: "Leads (incl. planned solutions)",
};

/**
 * Starting conversion weightings from the specification (product of the
 * remaining step rates). Replaced by actual moving averages once monthly
 * snapshots exist — not yet built.
 */
export const STAGE_WEIGHTING: Record<PipelineStage, number> = {
  approved: 1,
  submitted: 0.7,
  planned: 0.63,
  leads: 0.315,
};

/** Spreadsheet Status (lower-cased) → pipeline stage. */
export const STATUS_TO_STAGE: Record<string, PipelineStage> = {
  unconditional: "approved",
  submitted: "submitted",
  "pre approved": "submitted",
  "planned submission": "planned",
  "planned solution": "leads",
  lead: "leads",
  prospect: "leads",
  "referrer set up": "leads",
  warm: "leads",
  "follow up": "leads",
  active: "leads",
};

/** Statuses deliberately kept out of the pipeline (shown in the reconciliation). */
export const EXCLUDED_STATUSES: Record<string, string> = {
  hold: "On Hold",
  "pre approval expired": "Pre-approval expired",
  lost: "Lost",
};

/** Leads older than this (by earliest recorded date) don't count in the pipeline. */
export const LEAD_MAX_AGE_MONTHS = 6;

// Shared cell-value normalisation for both import sources: Microsoft Graph
// (returns JSON numbers/strings/booleans from Excel Online) and an uploaded
// .xlsx file parsed with exceljs (returns numbers, strings, or Date objects
// for date-formatted cells). One set of rules here means the mapping logic
// in syncRows.ts never has to care which source a row came from.

export type SourceCell = string | number | boolean | Date | null | undefined;
export type SourceRow = SourceCell[];

export function cellToText(value: SourceCell): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

export function cellToNumber(value: SourceCell): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Excel's day-0 is 1899-12-30 in the (buggy, but universal) 1900 date
// system both Excel Online and desktop Excel use for numeric date values.
function excelSerialToISODate(serial: number): string | null {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function cellToISODate(value: SourceCell): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return excelSerialToISODate(value);
  if (typeof value === "string") {
    const n = Number(value.trim());
    return Number.isFinite(n) && value.trim() !== "" ? excelSerialToISODate(n) : null;
  }
  return null;
}

export function indexHeaders(headerRow: SourceRow): Record<string, number> {
  const index: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    index[cellToText(h).toLowerCase()] = i;
  });
  return index;
}

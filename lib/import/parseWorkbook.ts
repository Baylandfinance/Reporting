import ExcelJS from "exceljs";
import JSZip from "jszip";
import type { SourceCell, SourceRow } from "./normalize";

// Deliberately using exceljs, not the npm `xlsx` package: as of writing,
// `xlsx` on the npm registry carries two unpatched high-severity
// advisories (prototype pollution, ReDoS) with no fix available there —
// see docs/SECURITY.md. This function parses files uploaded by an admin
// (attacker-controlled input in principle), so the parser's own track
// record matters.

function cellValueToPrimitive(value: ExcelJS.CellValue): SourceCell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    // Formula result: { formula, result }
    if ("result" in value) return cellValueToPrimitive(value.result as ExcelJS.CellValue);
    // Rich text: { richText: [{ text }, ...] }
    if ("richText" in value && Array.isArray((value as { richText: { text: string }[] }).richText)) {
      return (value as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
    }
    // Hyperlink: { text, hyperlink }
    if ("text" in value) return String((value as { text: unknown }).text);
    return String(value);
  }
  return value as SourceCell;
}

const TABLE_OR_SHEET_XML = /^xl\/(tables\/table\d+|worksheets\/sheet\d+)\.xml$/;

/**
 * Removes saved filter criteria (<filterColumn> elements) from every table
 * and worksheet in the workbook, leaving the data itself untouched.
 *
 * exceljs 4.4.0 throws "Unexpected xml node in parseOpen: dateGroupItem"
 * on an Excel Table whose date filter has more than one year/month ticked
 * — a filter someone left applied in the loan tracker made every upload
 * fail outright. The importer reads every row regardless of filtering
 * (hidden rows included), so the filter criteria carry nothing it needs.
 */
async function stripFilterCriteria(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer);
  let changed = false;

  for (const path of Object.keys(zip.files)) {
    if (!TABLE_OR_SHEET_XML.test(path)) continue;
    const xml = await zip.file(path)!.async("string");
    const stripped = xml.replace(/<filterColumn\b[^>]*?(?:\/>|>[\s\S]*?<\/filterColumn>)/g, "");
    if (stripped !== xml) {
      zip.file(path, stripped);
      changed = true;
    }
  }

  return changed ? zip.generateAsync({ type: "arraybuffer" }) : buffer;
}

/** Parses the first worksheet of an uploaded .xlsx file into header + data rows. */
export async function parseWorkbookFirstSheet(
  buffer: ArrayBuffer
): Promise<{ worksheetName: string; rows: SourceRow[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await stripFilterCriteria(buffer));

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return { worksheetName: "Sheet1", rows: [] };
  }

  const rows: SourceRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as ExcelJS.CellValue[];
    // exceljs's row.values is 1-indexed with index 0 unused — drop it.
    rows.push(values.slice(1).map(cellValueToPrimitive));
  });

  return { worksheetName: worksheet.name, rows };
}

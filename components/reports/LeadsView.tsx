import { AlertTriangle, Handshake, Home, Inbox, Repeat } from "lucide-react";
import { Card } from "@/components/charts/Card";
import { StatTile } from "@/components/charts/StatTile";
import { MultiLine } from "@/components/charts/MultiLine";
import { ReportTable, type ReportRow } from "@/components/reports/ReportTable";
import type { CountLine, LeadsReport, MappingLine } from "@/lib/reports/leads";
import { SOURCE_GROUP_ORDER } from "@/lib/reports/leads-config";

const COUNT = new Intl.NumberFormat("en-AU");

export function LeadsView({ report }: { report: LeadsReport }) {
  const total = report.totalLeads;
  const share = (v: number) => (total ? `${((v / total) * 100).toFixed(1)}%` : null);
  const headers = [...report.months.map((m) => m.label), `${report.months.length}-mth`, "% total"];
  const toRow = (l: CountLine, kind?: ReportRow["kind"], indent = false): ReportRow => ({
    label: l.label,
    cells: [...l.monthly, l.total, share(l.total)],
    kind,
    indent,
  });
  const totalLine: CountLine = { label: "Total leads", monthly: report.monthlyTotals, total };

  const groupTotal = (g: string) => report.sourcesByGroup.find((s) => s.group === g)?.subtotal.total ?? 0;
  const residential = report.categories.find((c) => c.category === "Residential")?.total ?? 0;
  const lastMonth = report.monthlyTotals[report.monthlyTotals.length - 1] ?? 0;

  const crossRows = (table: Record<string, Record<string, number>>): ReportRow[] => {
    const order = report.typesByCategory.flatMap((c) => c.lines.map((l) => l.label));
    const rows: ReportRow[] = order
      .filter((label) => table[label])
      .map((label) => {
        const cells = SOURCE_GROUP_ORDER.map((g) => table[label]![g] || null);
        return { label, cells: [...cells, cells.reduce<number>((s, c) => s + (c ?? 0), 0)] };
      });
    const colTotals = SOURCE_GROUP_ORDER.map((g) => order.reduce((s, label) => s + (table[label]?.[g] ?? 0), 0));
    rows.push({ label: "Total", kind: "total", cells: [...colTotals, colTotals.reduce((s, v) => s + v, 0)] });
    return rows;
  };

  return (
    <>
      {report.loansRead !== report.totalLoansInDatabase && (
        <div className="flex items-start gap-3 rounded-xl border border-status-critical/40 bg-status-critical/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-critical" />
          The database holds {COUNT.format(report.totalLoansInDatabase)} loans but this report read{" "}
          {COUNT.format(report.loansRead)}. Reload the page; if it persists, don&apos;t rely on these numbers.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={`Leads – ${report.months.length} months`} value={COUNT.format(total)} delta={`${lastMonth} in ${report.reportMonth.label}`} deltaDirection="neutral" icon={Inbox} />
        <StatTile label="Residential share" value={share(residential) ?? "–"} delta={`${COUNT.format(residential)} leads`} deltaDirection="neutral" icon={Home} />
        <StatTile label="From referral partners" value={share(groupTotal("Referral partner")) ?? "–"} delta={`${COUNT.format(groupTotal("Referral partner"))} leads`} deltaDirection="neutral" icon={Handshake} />
        <StatTile label="From existing clients" value={share(groupTotal("Existing client")) ?? "–"} delta={`${COUNT.format(groupTotal("Existing client"))} leads`} deltaDirection="neutral" icon={Repeat} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Leads by category – trend" subtitle="A line per category">
          <MultiLine
            data={report.months.map((m, i) => ({ label: m.label, ...Object.fromEntries(report.categories.map((c) => [c.category, c.monthly[i] ?? 0])) }))}
            series={report.categories.filter((c) => c.total > 0).map((c) => ({ key: c.category, label: c.category }))}
          />
        </Card>
        <Card title="Leads by source group – trend" subtitle="A line per source group">
          <MultiLine
            data={report.months.map((m, i) => ({ label: m.label, ...Object.fromEntries(report.sourcesByGroup.map((g) => [g.group, g.subtotal.monthly[i] ?? 0])) }))}
            series={report.sourcesByGroup.filter((g) => g.subtotal.total > 0).map((g) => ({ key: g.group, label: g.group }))}
          />
        </Card>
      </div>

      <Card title="1. Summary by category" subtitle="Leads by month, with each category's share of the total">
        <ReportTable firstColumnLabel="Category" headers={headers} rows={[...report.categories.map((c) => toRow(c)), toRow(totalLine, "total")]} />
      </Card>

      <Card
        title="2. Lead types by month"
        subtitle="From the Transaction Type column. Where the sheet doesn't say owner-occupied or investment, the lead shows on a “not recorded” line."
      >
        <ReportTable
          firstColumnLabel="Lead type"
          headers={headers}
          rows={[
            ...report.typesByCategory.flatMap((c) =>
              c.lines.length === 1 ? [toRow(c.lines[0]!)] : [...c.lines.map((l) => toRow(l, undefined, true)), toRow(c.subtotal, "subtotal")]
            ),
            toRow(totalLine, "total"),
          ]}
        />
      </Card>

      <Card title="3. Lead sources by month" subtitle="From the Lead Origination column, with existing client and referral partner subtotals">
        <ReportTable
          firstColumnLabel="Source"
          headers={headers}
          rows={[
            ...report.sourcesByGroup.flatMap((g) =>
              g.lines.length === 1 && g.lines[0]!.label === g.group
                ? [toRow(g.lines[0]!)]
                : [...g.lines.map((l) => toRow(l, undefined, true)), toRow(g.subtotal, "subtotal")]
            ),
            toRow(totalLine, "total"),
          ]}
        />
      </Card>

      <div className="grid grid-cols-1 gap-6">
        <Card title={`4. Source by loan type – ${report.reportMonth.label}`} subtitle="Which source group each loan type came from">
          <ReportTable firstColumnLabel="Lead type" headers={[...SOURCE_GROUP_ORDER, "Total"]} rows={crossRows(report.crossTab.month)} />
        </Card>
        <Card title={`4. Source by loan type – ${report.months.length} months`} subtitle="Same split across the whole period">
          <ReportTable firstColumnLabel="Lead type" headers={[...SOURCE_GROUP_ORDER, "Total"]} rows={crossRows(report.crossTab.window)} />
        </Card>
      </div>

      <Card
        title="Where every loan went"
        subtitle={`All ${COUNT.format(report.loansRead)} loans on file, each counted once. Every loan is one lead, dated by its earliest Enquiry, Quote or Application date.`}
      >
        <table className="w-full text-sm">
          <tbody className="divide-y divide-grid dark:divide-grid-dark">
            {report.reconciliation.map((l) => (
              <tr key={l.label}>
                <td className="py-2 text-ink-secondary dark:text-ink-secondary-dark">
                  {l.label}
                  {l.inReport && <span className="ml-2 text-xs font-medium text-status-good">counted</span>}
                </td>
                <td className="py-2 text-right tabular-nums text-ink dark:text-ink-dark">{COUNT.format(l.count)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-2 text-ink dark:text-ink-dark">Total accounted for</td>
              <td className="py-2 text-right tabular-nums text-ink dark:text-ink-dark">
                {COUNT.format(report.reconciliation.reduce((s, l) => s + l.count, 0))} of {COUNT.format(report.totalLoansInDatabase)}
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 print:hidden">
        <MappingCard title="How Transaction Type values were classified" lines={report.typeMapping} />
        <MappingCard title="How Lead Origination values were classified" lines={report.sourceMapping} />
      </div>
    </>
  );
}

function MappingCard({ title, lines }: { title: string; lines: MappingLine[] }) {
  return (
    <Card title={title} subtitle={`${COUNT.format(lines.length)} different spreadsheet values in this period. Tell us if any are in the wrong place.`}>
      <details>
        <summary className="cursor-pointer text-sm font-medium text-series-1">Show all values</summary>
        <div className="mt-3 max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted">
                <th className="pb-2 font-medium">Spreadsheet value</th>
                <th className="pb-2 font-medium">Counted as</th>
                <th className="pb-2 text-right font-medium">Leads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid dark:divide-grid-dark">
              {lines.map((l) => (
                <tr key={l.raw}>
                  <td className="py-1.5 pr-3 text-ink dark:text-ink-dark">{l.raw}</td>
                  <td className="py-1.5 pr-3 text-ink-secondary dark:text-ink-secondary-dark">{l.mappedTo}</td>
                  <td className="py-1.5 text-right tabular-nums text-ink dark:text-ink-dark">{COUNT.format(l.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}

import { Inbox, Handshake, Home, Repeat } from "lucide-react";
import { Topbar } from "@/components/nav/Topbar";
import { Card } from "@/components/charts/Card";
import { StatTile } from "@/components/charts/StatTile";
import { MultiLine } from "@/components/charts/MultiLine";
import { ReportTable, type ReportRow } from "@/components/reports/ReportTable";

// PREVIEW ONLY — dummy data copied from "Leads Marketing Report – Specification"
// (45 leads a month, identical every month, Jan–Oct 2026).

const MONTHS = ["Jan-26", "Feb-26", "Mar-26", "Apr-26", "May-26", "Jun-26", "Jul-26", "Aug-26", "Sep-26", "Oct-26"];
const TOTAL_PER_MONTH = 45;

function line(label: string, perMonth: number, kind?: ReportRow["kind"], indent = false): ReportRow {
  const total = perMonth * MONTHS.length;
  const share = ((total / (TOTAL_PER_MONTH * MONTHS.length)) * 100).toFixed(1) + "%";
  return { label, cells: [...MONTHS.map(() => perMonth), total, share], kind, indent };
}

const HEADERS = [...MONTHS, "10-mth", "% total"];

const CROSS_TAB: [string, (number | null)[]][] = [
  ["First Home Buyers", [1, null, 1, 1, null, 5, 2, 3]],
  ["OO Purchases", [1, null, null, 2, null, null, 1, 1]],
  ["OO Refinances", [3, 3, 1, null, 1, null, 1, 1]],
  ["Inv Purchases", [1, 1, 1, 2, null, null, null, null]],
  ["Inv Refinances", [1, 1, null, null, null, null, null, null]],
  ["Commercial Purchases", [null, null, null, null, 1, null, null, null]],
  ["Business Purchases", [null, null, null, null, 1, null, null, null]],
  ["Commercial Refinances", [null, null, null, null, null, null, null, null]],
  ["Commercial SMSF Purchases", [null, null, 2, null, null, null, null, null]],
  ["Commercial SMSF Refinances", [null, 2, null, null, null, null, null, null]],
  ["Motor Vehicle Finance", [null, null, null, null, 1, null, null, null]],
  ["Plant and Equipment", [null, null, null, null, null, null, null, null]],
  ["Cashflow Loan", [null, null, null, null, 1, null, null, null]],
  ["Personal Loans", [null, null, null, null, null, null, 1, null]],
  ["Business Advisory", [1, null, null, null, null, null, null, null]],
];

export default function LeadsPreview() {
  const categoryTrend = MONTHS.map((label) => ({ label, res: 35, com: 6, asset: 2, pers: 1, adv: 1 }));
  const sourceTrend = MONTHS.map((label) => ({ label, existing: 15, referral: 20, phone: 5, online: 5 }));

  return (
    <>
      <Topbar
        title="Leads & Marketing"
        subtitle="Monthly lead volumes by loan type and lead source. Rolling 10 months to 31 Oct 2026."
      />
      <main className="flex-1 space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-ink-muted">Period</span>
          <span className="rounded-lg border border-grid bg-surface px-3 py-1.5 font-medium text-ink">Jan – Oct 2026 ▾</span>
          <span className="ml-auto rounded-lg border border-grid bg-surface px-3 py-1.5 font-medium text-ink">Export PDF</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Leads – 10 months" value="450" delta="45 in October" deltaDirection="neutral" icon={Inbox} />
          <StatTile label="Residential share" value="77.8%" delta="350 leads" deltaDirection="neutral" icon={Home} />
          <StatTile label="From referral partners" value="44.4%" delta="200 leads" deltaDirection="neutral" icon={Handshake} />
          <StatTile label="From existing clients" value="33.3%" delta="150 leads" deltaDirection="neutral" icon={Repeat} />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card title="1. Leads by category – trend" subtitle="A line per category">
            <MultiLine
              data={categoryTrend}
              series={[
                { key: "res", label: "Residential" },
                { key: "com", label: "Commercial" },
                { key: "asset", label: "Asset Finance" },
                { key: "pers", label: "Personal Loans" },
                { key: "adv", label: "Business Advisory" },
              ]}
            />
          </Card>
          <Card title="3. Leads by source group – trend" subtitle="A line per source group">
            <MultiLine
              data={sourceTrend}
              series={[
                { key: "existing", label: "Existing client" },
                { key: "referral", label: "Referral partner" },
                { key: "phone", label: "Phone enquiry" },
                { key: "online", label: "Online enquiry" },
              ]}
            />
          </Card>
        </div>

        <Card title="1. Summary by category" subtitle="Leads by month, with each category's share of the total">
          <ReportTable
            firstColumnLabel="Category"
            headers={HEADERS}
            rows={[
              line("Residential", 35),
              line("Commercial", 6),
              line("Asset Finance", 2),
              line("Personal Loans", 1),
              line("Business Advisory", 1),
              line("Total leads", 45, "total"),
            ]}
          />
        </Card>

        <Card title="2. Lead types by month" subtitle="All 15 lead types, with a subtotal per category">
          <ReportTable
            firstColumnLabel="Lead type"
            headers={HEADERS}
            rows={[
              line("First Home Buyers", 13, undefined, true),
              line("OO Purchases", 5, undefined, true),
              line("OO Refinances", 10, undefined, true),
              line("Inv Purchases", 5, undefined, true),
              line("Inv Refinances", 2, undefined, true),
              line("Residential subtotal", 35, "subtotal"),
              line("Commercial Purchases", 1, undefined, true),
              line("Business Purchases", 1, undefined, true),
              line("Commercial Refinances", 0, undefined, true),
              line("Commercial SMSF Purchases", 2, undefined, true),
              line("Commercial SMSF Refinances", 2, undefined, true),
              line("Commercial subtotal", 6, "subtotal"),
              line("Motor Vehicle Finance", 1, undefined, true),
              line("Plant and Equipment", 0, undefined, true),
              line("Cashflow Loan", 1, undefined, true),
              line("Asset Finance subtotal", 2, "subtotal"),
              line("Personal Loans", 1),
              line("Business Advisory", 1),
              line("Total leads", 45, "total"),
            ]}
          />
        </Card>

        <Card title="3. Lead sources by month" subtitle="Each source, with existing client and referral partner subtotals">
          <ReportTable
            firstColumnLabel="Source"
            headers={HEADERS}
            rows={[
              line("Existing – client initiated", 8, undefined, true),
              line("Existing – broker initiated", 7, undefined, true),
              line("Existing client subtotal", 15, "subtotal"),
              line("Modi", 5, undefined, true),
              line("Property Advocate", 5, undefined, true),
              line("BNI", 5, undefined, true),
              line("Real Estate Agent", 5, undefined, true),
              line("Referral partner subtotal", 20, "subtotal"),
              line("New phone enquiry", 5),
              line("Online enquiry", 5),
              line("Total leads", 45, "total"),
            ]}
          />
        </Card>

        <Card title="4. Source by loan type – October 2026" subtitle="Which channel each loan type came from (illustrative split from the spec)">
          <ReportTable
            firstColumnLabel="Lead type"
            headers={["Exist. client", "Exist. broker", "Modi", "Prop. Adv.", "BNI", "REA", "Phone", "Online", "Total"]}
            rows={[
              ...CROSS_TAB.map(([label, cells]) => ({
                label,
                cells: [...cells, cells.reduce<number>((s, c) => s + (c ?? 0), 0)],
              })),
              { label: "Total", cells: [8, 7, 5, 5, 5, 5, 5, 5, 45], kind: "total" as const },
            ]}
          />
        </Card>
      </main>
    </>
  );
}

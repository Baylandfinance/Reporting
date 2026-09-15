"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

// Fixed categorical order — never reassigned by sort order or filter state,
// per the validated palette's CVD-safe slot ordering.
const SLOT_COLORS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
];

type Segment = { label: string; value: number };

export function DonutBreakdown({
  data,
  centerLabel,
}: {
  data: Segment[];
  centerLabel: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={SLOT_COLORS[i % SLOT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #e1e0d9",
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tabular-nums text-ink dark:text-ink-dark">
            {total}
          </span>
          <span className="text-[11px] text-ink-muted">{centerLabel}</span>
        </div>
      </div>

      <ul className="space-y-2 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: SLOT_COLORS[i % SLOT_COLORS.length] }}
            />
            <span className="text-ink-secondary dark:text-ink-secondary-dark">
              {d.label}
            </span>
            <span className="ml-auto font-medium tabular-nums text-ink dark:text-ink-dark">
              {d.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Fixed categorical order from tailwind.config.ts's series tokens — a
// series keeps its colour by position, never re-cycled by rank.
const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

export type MultiLineSeries = { key: string; label: string };

/**
 * Several series over the same months on one axis (e.g. a line per team or
 * per lead category). Always shows a legend, since colour alone must never
 * be the only way to tell lines apart. Optional reference line marks a
 * single value such as a YTD average.
 */
export function MultiLine({
  data,
  series,
  format = "count",
  reference,
}: {
  data: Record<string, string | number | null>[];
  series: MultiLineSeries[];
  format?: "count" | "thousands" | "millions" | "percent";
  reference?: { value: number; label: string };
}) {
  const formatValue = (v: number) => {
    switch (format) {
      case "thousands":
        return `$${Math.round(v).toLocaleString("en-AU")}k`;
      case "millions":
        return `$${v.toFixed(1)}m`;
      case "percent":
        return `${Math.round(v)}%`;
      default:
        return Math.round(v).toLocaleString("en-AU");
    }
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="#e1e0d9" vertical={false} />
        <XAxis
          dataKey="label"
          axisLine={{ stroke: "#c3c2b7" }}
          tickLine={false}
          tick={{ fill: "#898781", fontSize: 12 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#898781", fontSize: 12 }}
          tickFormatter={formatValue}
          width={56}
        />
        <Tooltip
          formatter={(value) => formatValue(Number(value))}
          contentStyle={{ borderRadius: 8, border: "1px solid #e1e0d9", fontSize: 12 }}
        />
        <Legend
          iconType="plainline"
          wrapperStyle={{ fontSize: 12, color: "#52514e" }}
          // Keep the caller's series order (e.g. funnel order), not alphabetical.
          itemSorter={(item) => series.findIndex((s) => s.label === item.value)}
        />
        {reference && (
          <ReferenceLine
            y={reference.value}
            stroke="#898781"
            strokeDasharray="4 4"
            label={{ value: reference.label, position: "insideTopRight", fill: "#52514e", fontSize: 11 }}
          />
        )}
        {series.map((s, i) => {
          const color = SERIES_COLORS[i % SERIES_COLORS.length];
          return (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 4, strokeWidth: 2, stroke: "#fcfcfb", fill: color }}
              activeDot={{ r: 5, fill: color }}
              connectNulls={false}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}

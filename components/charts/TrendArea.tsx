"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { label: string; value: number };

const CURRENCY = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

const COUNT = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });

/**
 * Single-series magnitude-over-time chart. One series needs no legend — the
 * card title names it. Defaults to currency formatting (its original use,
 * settlement value); pass `format="count"` for a plain-number series like
 * leads or submissions, so the axis and tooltip don't show a $ sign on a
 * chart of loan counts.
 */
export function TrendArea({
  data,
  format = "currency",
}: {
  data: Point[];
  format?: "currency" | "count";
}) {
  const formatValue = format === "count" ? (v: number) => COUNT.format(v) : (v: number) => CURRENCY.format(v);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a78d6" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#2a78d6" stopOpacity={0} />
          </linearGradient>
        </defs>
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
          allowDecimals={format === "currency"}
          width={format === "count" ? 32 : 72}
        />
        <Tooltip
          formatter={(value) => formatValue(Number(value))}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e1e0d9",
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#2a78d6"
          strokeWidth={2}
          fill="url(#trendFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

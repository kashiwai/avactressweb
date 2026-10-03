"use client";
// ダッシュボードのグラフ
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function WorkingForecastChart({ data }: { data: Array<{ label: string; count: number }> }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#e3e6eb" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#5f6673", fontSize: 11 }} axisLine={{ stroke: "#e3e6eb" }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: "#5f6673", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(244,63,94,0.08)" }}
            contentStyle={{ background: "#ffffff", border: "1px solid #e3e6eb", borderRadius: 8, color: "#16181d", fontSize: 12 }}
            formatter={(v) => [`${v}人`, "出勤予定"]}
          />
          <Bar dataKey="count" fill="#e11d48" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

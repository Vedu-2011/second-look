"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import type { SafetyMetric } from "@/lib/research-holdout-results";
export function HoldoutCharts({
  metrics,
}: {
  metrics: Record<string, SafetyMetric>;
}) {
  const rows = Object.entries(metrics).map(([name, m]) => ({
    name:
      name === "Direct Sonnet"
        ? "Direct AI"
        : name.includes("two")
          ? "Two views"
          : "One view",
    "Wrong called fine": m.wrongPassed,
    "False alarms": m.falseAlarms,
    "Correct when answered":
      m.decisiveAccuracy === null ? null : m.decisiveAccuracy * 100,
    Coverage: (m.coverage ?? 0) * 100,
  }));
  return (
    <div className="mt-8 space-y-8">
      {[
        {
          title: "Mistakes, not just catches",
          keys: ["Wrong called fine", "False alarms"],
          percent: false,
          tip: "Lower is better. Counts out of the same right/wrong pairs; the full table follows.",
        },
        {
          title: "How often does it answer?",
          keys: ["Correct when answered", "Coverage"],
          percent: true,
          tip: "Accuracy among answers must be read with coverage. Abstaining is not a correct answer. If there are no answers, accuracy is n/a.",
        },
      ].map((chart) => (
        <section
          key={chart.title}
          className="rounded-[var(--radius-photo)] bg-foil p-4 sm:p-6"
        >
          <h2 className="text-2xl font-bold">{chart.title}</h2>
          <p className="mt-2 text-lg text-ink-soft">{chart.tip}</p>
          <div
            className="mt-4 h-80 w-full min-w-0"
            role="img"
            aria-label={chart.title + "; exact counts are in the table below."}
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={rows}
                margin={{ left: 0, right: 4, top: 15, bottom: 15 }}
                accessibilityLayer
              >
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 13, fill: "#17202B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={chart.percent ? [0, 100] : [0, "auto"]}
                  allowDecimals={false}
                  unit={chart.percent ? "%" : undefined}
                  tick={{ fontSize: 13 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v) =>
                    chart.percent ? `${Math.floor(Number(v) * 10) / 10}%` : v
                  }
                  contentStyle={{ border: 0, borderRadius: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 14 }} />
                {chart.keys.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={i === 0 ? "#17202B" : "#9A5F0C"}
                    radius={[5, 5, 0, 0]}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ))}
    </div>
  );
}

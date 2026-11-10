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
import type { ResearchResults } from "@/lib/research-results";

const short = (key: string) =>
  key.includes("haiku") ? "Haiku" : key === "baseline" ? "Direct AI" : "Sonnet";
function Chart({
  data,
  keys,
  label,
}: {
  data: Record<string, string | number>[];
  keys: { key: string; color: string }[];
  label: string;
}) {
  return (
    <div role="img" aria-label={label} className="h-80 min-w-0 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 4, bottom: 20, left: 0 }}
          accessibilityLayer
        >
          <XAxis
            dataKey="name"
            tick={{ fontSize: 13, fill: "#17202B" }}
            interval={0}
            height={55}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            unit="%"
            tick={{ fontSize: 14 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => `${Math.floor(Number(value) * 10) / 10}%`}
            contentStyle={{ border: 0, borderRadius: 12, fontSize: 16 }}
          />
          <Legend wrapperStyle={{ fontSize: 14 }} />
          {keys.map((k) => (
            <Bar
              key={k.key}
              dataKey={k.key}
              fill={k.color}
              radius={[6, 6, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ResearchCharts({ results: r }: { results: ResearchResults }) {
  const methods = [...r.models, "baseline"];
  const comparison = methods.map((key) => ({
    name: short(key),
    "Caught wrong pills": (r.metrics[key].catchRate ?? 0) * 100,
    "False alarms": (r.metrics[key].falseAlarmRate ?? 0) * 100,
  }));
  const difficulty = methods.map((key) => ({
    name: short(key),
    Easy: r.metrics[key].easy.n
      ? (r.metrics[key].easy.caught / r.metrics[key].easy.n) * 100
      : 0,
    Hard: r.metrics[key].hard.n
      ? (r.metrics[key].hard.caught / r.metrics[key].hard.n) * 100
      : 0,
  }));
  const accuracy = r.models.map((key) => ({
    name: short(key),
    Exact: (r.reading[key].exact / r.images) * 100,
    Close: (r.reading[key].close / r.images) * 100,
    Wrong: (r.reading[key].wrong / r.images) * 100,
    "No read": (r.reading[key].noRead / r.images) * 100,
  }));
  return (
    <div className="space-y-10">
      <section className="rounded-[var(--radius-photo)] bg-foil p-4 sm:p-7">
        <h2 className="text-2xl font-bold">Catches and false alarms</h2>
        <p className="mt-2 text-base text-ink-soft">
          Higher catch rate is better. Lower false-alarm rate is better. Direct
          AI uses Sonnet only; both pipelines use the same deterministic rules.
        </p>
        <Chart
          data={comparison}
          keys={[
            { key: "Caught wrong pills", color: "#17202B" },
            { key: "False alarms", color: "#9A5F0C" },
          ]}
          label="Wrong-pill catch rates and right-pill false alarm rates; exact counts are in the table below."
        />
      </section>
      <section>
        <h2 className="text-2xl font-bold">When the pills look alike</h2>
        <p className="mt-2 text-base text-ink-soft">
          Hard pairs have the same FDA color and shape but different imprints
          and medicines. Easy pairs are the remaining negatives.
          Zero-denominator categories are listed as n/a in the table.
        </p>
        <Chart
          data={difficulty}
          keys={[
            { key: "Easy", color: "#17202B" },
            { key: "Hard", color: "#4A5A85" },
          ]}
          label="Wrong-pill catch rate for easy and hard pairs; exact denominators appear below."
        />
      </section>
      <section className="rounded-[var(--radius-photo)] bg-foil p-4 sm:p-7">
        <h2 className="text-2xl font-bold">Reading the imprint</h2>
        <p className="mt-2 text-base text-ink-soft">
          A photo can show one side. Exact means its visible tokens agree with
          the FDA; close allows look-alike characters such as I and 1.
        </p>
        <Chart
          data={accuracy}
          keys={[
            { key: "Exact", color: "#17202B" },
            { key: "Close", color: "#4A5A85" },
            { key: "Wrong", color: "#9A5F0C" },
            { key: "No read", color: "#8993A1" },
          ]}
          label="Imprint reading accuracy, with exact, close, wrong and no-read outcomes for each model."
        />
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import { ResearchCharts } from "@/components/research-charts";
import {
  RESEARCH_RESULTS as r,
  researchHeadline,
} from "@/lib/research-results";
import { percent } from "@/lib/research";
export const metadata: Metadata = { title: "Research: the NIH photo test" };
const github = "https://github.com/Vedu-2011/second-look/blob/main/research/";
export default function ResearchPage() {
  if (!r)
    return (
      <div className="mx-auto max-w-3xl px-5 pt-10">
        <h1 className="text-4xl font-bold">The NIH photo test</h1>
        <p className="mt-5 text-lg">
          Verified benchmark results are unavailable. We only publish
          measurements from a complete, validated run.
        </p>
      </div>
    );
  return (
    <div className="mx-auto max-w-5xl px-5 pt-10 sm:px-8 sm:pt-14">
      <h1 className="text-4xl font-bold tracking-tight">
        How well does it catch a wrong pill?
      </h1>
      <p className="mt-5 max-w-3xl text-xl font-semibold">
        {researchHeadline(r)}
      </p>
      <p className="mt-4 text-lg text-ink-soft">
        A fixed test of {r.images} real consumer photos across {r.products}{" "}
        product codes. No images were chosen based on the AI&apos;s answers.
        Rates are truncated to one decimal place.
      </p>
      <p className="mt-5 max-w-3xl rounded-[var(--radius-row)] bg-foil p-5 text-lg">
        Direct AI caught {r.metrics.baseline.caught}/{r.images} wrong pills,
        compared with {r.metrics[r.models[0]].caught}/{r.images} for the Sonnet
        pipeline. It also raised {r.metrics.baseline.falseAlarms} false alarms,
        versus {r.metrics[r.models[0]].falseAlarms}. The pipeline abstained on{" "}
        {r.metrics[r.models[0]].unsure}/{r.pairs} pairs. This test shows a
        tradeoff, not an overall accuracy win.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={github + "REPORT.md"}
          className="inline-flex min-h-12 items-center rounded-full bg-foil px-5 font-semibold"
        >
          Read the method and report ↗
        </a>
        <a
          href={github + "out/pairs.csv"}
          className="inline-flex min-h-12 items-center rounded-full bg-foil px-5 font-semibold"
        >
          Audit every pair ↗
        </a>
      </div>
      <div className="mt-12">
        <ResearchCharts results={r} />
      </div>
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Every outcome counts</h2>
        <p className="mt-2 text-base text-ink-soft">
          Scroll the table sideways on a phone to see every column.
        </p>
        <div className="mt-5 overflow-x-auto rounded-[var(--radius-card)] bg-foil p-4">
          <table className="w-full text-left text-base">
            <caption className="mb-4 text-left text-ink-soft">
              Each method sees {r.images} right pairs and {r.images} wrong
              pairs. Abstentions are not counted as catches.
            </caption>
            <thead>
              <tr>
                {[
                  "Method",
                  "Caught wrong",
                  "False alarms",
                  "Right-pill passes",
                  "Unsure",
                  "Wrong-pill unsure",
                  "Easy caught",
                  "Hard caught",
                ].map((t) => (
                  <th key={t} className="p-3">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(r.metrics).map(([key, m]) => (
                <tr key={key}>
                  <th className="p-3 font-semibold">
                    {key.replace("claude-", "").replace("-5-5", "")}
                  </th>
                  <td className="p-3">
                    {m.caught}/{m.wrong} ({percent(m.catchRate)})
                  </td>
                  <td className="p-3">
                    {m.falseAlarms}/{m.right} ({percent(m.falseAlarmRate)})
                  </td>
                  <td className="p-3">
                    {m.passed}/{m.right} ({percent(m.passRate)})
                  </td>
                  <td className="p-3">
                    {m.unsure}/{m.n}
                  </td>
                  <td className="p-3">
                    {m.wrongUnsure}/{m.wrong}
                  </td>
                  <td className="p-3">
                    {m.easy.caught}/{m.easy.n}; {m.easy.unsure} unsure
                  </td>
                  <td className="p-3">
                    {m.hard.caught}/{m.hard.n}; {m.hard.unsure} unsure
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mt-12 max-w-3xl">
        <h2 className="text-2xl font-bold">How we tested</h2>
        <p className="mt-4 text-lg">
          We shuffled NIH consumer-photo products with seed {r.seed}, checked
          their NDCs against RxNav, and kept the first {r.products} eligible
          products with two photos each. {r.skipped.length} candidates were
          excluded during selection; every reason is in the source manifest.
          Each photo was paired once with its own label and once with a
          different medicine. At least half the wrong pairs are hard
          look-alikes.
        </p>
        <p className="mt-4 text-lg">
          Both models use production readPill, prompt {r.promptVersion}, once
          per image with its normal validation retry. The code compares those
          readings with FDA records. The baseline uses Sonnet with thinking set
          to “between_tools” and effort “high” (the documented
          no-up-front-thinking setting), while readers retain production
          reasoning settings. See the report for the initial output-budget
          correction. It asks directly whether the pictured pill matches the
          label. The no-fold rows use the same code with look-alike character
          folding disabled.
        </p>
        <p className="mt-4 text-lg text-ink-soft">
          Run: {r.date.slice(0, 10)} · Estimated model spend: $
          {r.totalUsd.toFixed(4)} · Sonnet reading:{" "}
          {(r.timing[r.models[0]].meanReadMs / 1000).toFixed(2)} seconds/image ·
          Haiku reading: {(r.timing[r.models[1]].meanReadMs / 1000).toFixed(2)}{" "}
          seconds/image. Timings exclude label-photo reading, explanation and
          UI. The report includes direct-AI timing.
        </p>
      </section>
      <section className="mt-10 rounded-[var(--radius-photo)] bg-foil p-5 sm:p-7">
        <h2 className="text-2xl font-bold">What this test cannot establish</h2>
        <p className="mt-3 text-lg">
          These archived NIH photos date from the 2016 challenge era. Some
          products are discontinued. Controlled consumer photos do not represent
          every phone, background, lighting condition or patient. One photo may
          hide an imprint side; size cannot be measured. The test uses known
          label NDCs, not label-photo reading, and does not establish clinical
          safety. Repeated photos of a product are correlated. This is a
          reproducible engineering test, not proof of errors prevented.
        </p>
        <p className="mt-4 text-base">
          <a
            className="underline underline-offset-4"
            href="https://data.lhncbc.nlm.nih.gov/public/Pills/index.html"
          >
            NIH dataset
          </a>{" "}
          ·{" "}
          <a
            className="underline underline-offset-4"
            href="https://pubmed.ncbi.nlm.nih.gov/29854569/"
          >
            Yaniv et al., dataset paper
          </a>{" "}
          ·{" "}
          <a className="underline underline-offset-4" href={github + "DATA.md"}>
            Exact sources and exclusions
          </a>
        </p>
      </section>
    </div>
  );
}

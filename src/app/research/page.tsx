import type { Metadata } from "next";
import {
  HOLDOUT_RESULTS as h,
  DEVELOPMENT_RESULTS as d,
  holdoutHeadline,
  type SafetyMetric,
} from "@/lib/research-holdout-results";
import { HoldoutCharts } from "@/components/holdout-charts";
import { percent } from "@/lib/research";
import postHoldout from "../../../research/out/post-fix-holdout.json";
import postDevelopment from "../../../research/out/post-fix-development.json";
export const metadata: Metadata = { title: "Research: the frozen NIH photo test", description: "Every outcome from 150 NIH photos: correct answers, mistakes and uncertainty, with a separate post-hoc safety-fix audit." };
const github = "https://github.com/Vedu-2011/second-look/blob/main/research/";
function Outcomes({
  metrics,
  caption,
}: {
  metrics: Record<string, SafetyMetric>;
  caption: string;
}) {
  return (
    <div
      className="mt-5 overflow-x-auto rounded-[var(--radius-card)] bg-foil p-3 sm:p-5"
      tabIndex={0}
      role="region"
      aria-label={caption + "; scroll sideways for all columns"}
    >
      <table className="w-full min-w-[850px] text-left text-base">
        <caption className="mb-4 text-left text-ink-soft">
          {caption}. Scroll sideways on a phone.
        </caption>
        <thead>
          <tr>
            {[
              "Method",
              "Wrong caught",
              "Wrong called fine",
              "False alarms",
              "Right passed",
              "Correct / answered",
              "Coverage",
              "Can’t tell",
            ].map((t) => (
              <th key={t} scope="col" className="p-3">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(metrics).map(([name, m]) => (
            <tr key={name}>
              <th scope="row" className="p-3 font-semibold">
                {name}
              </th>
              <td className="p-3">
                {m.caught}/{m.wrong}
              </td>
              <td className="p-3">
                {m.wrongPassed}/{m.wrong}
              </td>
              <td className="p-3">
                {m.falseAlarms}/{m.right}
              </td>
              <td className="p-3">
                {m.passed}/{m.right}
              </td>
              <td className="p-3">
                {m.correct}/{m.decisive} ({percent(m.decisiveAccuracy)})
              </td>
              <td className="p-3">
                {m.decisive}/{m.n} ({percent(m.coverage)})
              </td>
              <td className="p-3">
                {m.unsure}/{m.n} ({percent(m.unsureRate)})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default function ResearchPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 pt-10 sm:px-8 sm:pt-14">
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight">
        A frozen test, with every outcome counted
      </h1>
      <p className="mt-5 max-w-3xl text-xl font-semibold">
        {h
          ? holdoutHeadline(h)
          : "The new holdout test is not published yet. The development results below are not a fresh test."}
      </p>
      <ol className="mt-7 max-w-3xl list-decimal space-y-4 pl-7 text-lg marker:font-bold">
        <li>Direct AI also said “can’t tell” on 206/300 pairs (68.6%, about 69%). These 2016-era single-view photos were hard for both systems in this test.</li>
        <li>When Second Look answered, it was right 83/88 times, versus 83/94 for direct AI. It made 4 false alarms versus 9, and passed 1 wrong pill versus 2. Most pairs still went unanswered.</li>
        <li>The fresh test found a real safety bug: a single “5” looked like one side of “598;S”. We fixed it. The frozen results above stay unchanged; the separate before/after audit below is post-hoc.</li>
      </ol>
      <p className="mt-4 max-w-3xl text-lg text-ink-soft">
        A wrong pill called fine matters. So does how often we cannot tell. We
        show both, along with false alarms and correct answers. These are
        engineering measurements, not a promise of clinical safety.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {[
          ["REPORT.md", "Read the report"],
          ["out/holdout-pairs.csv", "Audit every holdout pair"],
          ["HOLDOUT-DATA.md", "See the exact photos"],
        ].map(([path, label]) => (
          <a
            key={path}
            href={github + path}
            className="inline-flex min-h-12 items-center rounded-full bg-foil px-5 font-semibold"
          >
            {label} ↗
          </a>
        ))}
      </div>
      <section className="mt-10 max-w-3xl rounded-[var(--radius-card)] bg-foil p-6">
        <h2 className="text-2xl font-bold">Whole-bottle photos: a separate feature</h2>
        <p className="mt-3 text-lg">The whole-bottle check is not part of this benchmark. Code finds separate pills on a plain, contrasting surface, AI reads each crop, and the same rules compare each reading with FDA records. Touching pills or clutter require a retake.</p>
        <p className="mt-3 text-lg">Development-only composites reuse selected NIH consumer photographs to test the pipeline. They are functional demonstrations, not fresh accuracy evidence or a test of real bottle photos. No holdout photos or frozen benchmark results were changed. Only detected pills are checked; inspect the numbering for missed pills.</p>
      </section>
      {h && (
        <section className="mt-10">
          <h2 className="text-2xl font-bold">
            Frozen holdout: before either fix
          </h2>
          <p className="mt-3 max-w-3xl text-lg">
            {h.images} photos of {h.products} new products; {h.pairs} balanced
            pairs. {h.hardPairs}/{h.images} wrong pairs share the FDA color and
            shape but have different imprints and medicines. Product-code
            overlap with development: {h.productOverlap}.
          </p>
          <HoldoutCharts metrics={h.metrics} />
          <Outcomes
            metrics={h.metrics}
            caption={`Fresh holdout: ${h.images} right pairs and ${h.images} wrong pairs per method`}
          />
          <p className="mt-4 max-w-3xl text-lg text-ink-soft">
            “When it answered” excludes UNSURE, but does not exclude mistakes.
            Correct answers are right pills passed plus wrong pills caught. All
            methods use the same pairs. The one-view pipeline was chosen for the
            headline before testing, not because it won.
          </p>
        </section>
      )}
      <section className="mt-12" id="post-hoc">
        <h2 className="max-w-3xl text-2xl font-bold">After two fixes (post-hoc — this holdout is no longer untouched)</h2>
        <p className="mt-4 max-w-3xl text-lg">We blocked folded short or partial imprint passes and let close colors agree across two photos. All readings, photos and pairs are unchanged. This rescore made zero model calls ($0). These photos informed a fix, so the numbers below are not fresh evidence of accuracy or safety.</p>
        <p className="mt-4 max-w-3xl text-lg">On the same holdout, one view goes from 1 to 0 wrong passes, 83/88 to 83/87 correct answered, and 212 to 213 uncertain pairs. Two views go from 4 to 7 false alarms and 50 to 64 answered pairs. Higher coverage came with more false alarms; zero observed wrong passes is not proof of safety.</p>
        <Outcomes metrics={postHoldout.metrics} caption="Post-hoc holdout rescore, same 300 pairs" />
        <Outcomes metrics={postDevelopment.metrics} caption="Post-hoc development rescore, same 400 pairs" />
        <p className="mt-4 text-base"><a className="underline underline-offset-4" href={github + "out/post-fix-holdout.json"}>Audit the post-hoc holdout</a>{" · "}<a className="underline underline-offset-4" href={github + "out/post-fix-development.json"}>Audit the post-hoc development set</a></p>
      </section>
      <section className="mt-12 max-w-3xl">
        <h2 className="text-2xl font-bold">What changed before this test</h2>
        <p className="mt-4 text-lg">
          The old 200-photo test became our development set. Its diagnosis found
          missing text, low-confidence readings and eight rejected readings. We
          kept the 0.7 imprint-confidence threshold, cleaned overly long strings
          without inventing letters, and clarified that confidence means text
          legibility, not medicine identification.
        </p>
        <p className="mt-4 text-lg">
          You can now flip the same pill for another photo, or skip. Two-view
          checks combine visible text, but disagreeing colors, incompatible
          shapes or an unclear view remain uncertain. We did not add a looser
          partial-imprint rule.
        </p>
      </section>
      {d && (
        <section className="mt-10">
          <h2 className="text-2xl font-bold">
            Development only: the older photos
          </h2>
          <p className="mt-3 max-w-3xl text-lg">
            These {d.images} photos helped develop the changes. The table reuses
            old {d.readingVersion} readings with the new engine; they were not
            reread with v2. Strict two-view checks increased abstentions here.
            That result is not hidden and is not the headline.
          </p>
          <Outcomes
            metrics={d.metrics}
            caption="Development only, not fresh holdout results"
          />
          {!h && <HoldoutCharts metrics={d.metrics} />}
          <p className="mt-4 text-lg">
            <a
              className="underline underline-offset-4"
              href={github + "PHASE4-REPORT.md"}
            >
              Original phase-4 report
            </a>
            {" · "}
            <a
              className="underline underline-offset-4"
              href={github + "out/dev-diagnosis.md"}
            >
              Every development abstention
            </a>
          </p>
        </section>
      )}
      <section className="mt-12 max-w-3xl">
        <h2 className="text-2xl font-bold">How the holdout stayed separate</h2>
        <p className="mt-4 text-lg">
          A new fixed seed excludes every development product code, including
          other packages. To meet the hard-look-alike requirement, we selected
          60 mutually paired look-alike products from the first 100 eligible
          seeded records, then 15 additional products. This is a challenging,
          stratified sample, not a random sample of prescriptions. The code is
          committed and frozen before any model reading. Failed readings stay in
          every denominator.
        </p>
        {h && (
          <p className="mt-4 break-words text-base text-ink-soft">
            Frozen commit:{" "}
            <a
              className="underline"
              href={
                "https://github.com/Vedu-2011/second-look/commit/" +
                h.frozenCommit
              }
            >
              {h.frozenCommit}
            </a>
            <br />
            Seed {h.seed} · {h.model} · {h.promptVersion} ·{" "}
            {h.date.slice(0, 10)}
            <br />
            New estimated spend ${h.totalUsd.toFixed(4)} / $5. One-photo
            reading: {(h.meanReadMs / 1000).toFixed(2)} seconds; direct AI:{" "}
            {(h.meanBaselineMs / 1000).toFixed(2)} seconds/pair. These exclude
            the label, FDA lookup, explanation, upload and UI.
          </p>
        )}
      </section>
      <section className="mt-10 rounded-[var(--radius-photo)] bg-foil p-5 sm:p-7">
        <h2 className="text-2xl font-bold">What this cannot establish</h2>
        <p className="mt-3 text-lg">
          These are public, controlled NIH photos from the 2016 challenge era,
          with known label NDCs. Some products are discontinued and FDA records
          have changed. A second archive view is not guaranteed to show the
          opposite side or the same physical tablet. There are only 75 distinct
          two-view groups in the holdout, reused across anchors: observations
          are correlated, not independent clinical cases. Size and authenticity
          cannot be measured.
        </p>
        <p className="mt-4 text-lg">
          Models may have seen these public images during training. Product
          disjointness separates our tuning, not model pretraining. Different
          cohorts do not prove that a change caused a better result. Zero
          observed wrong passes would not prove safety. Ask your pharmacist
          about an uncertain or mismatched pill.
        </p>
        <p className="mt-4 text-base">
          <a
            className="underline"
            href="https://data.lhncbc.nlm.nih.gov/public/Pills/index.html"
          >
            NIH dataset
          </a>
          {" · "}
          <a
            className="underline"
            href="https://pubmed.ncbi.nlm.nih.gov/29854569/"
          >
            Yaniv et al., dataset paper
          </a>
        </p>
      </section>
    </div>
  );
}

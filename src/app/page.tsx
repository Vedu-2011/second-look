import { Camera, Pill, ScanSearch } from "lucide-react";
import Link from "next/link";
import { HOLDOUT_RESULTS as RESEARCH_RESULTS, holdoutHeadline as researchHeadline } from "@/lib/research-holdout-results";
import { ButtonLink } from "@/components/button";
import { PillDrawing } from "@/components/pill-drawing";
import { SourceBadge } from "@/components/source-badge";
import { colorNames, shapeName } from "@/lib/fda/codes";
import { IBUPROFEN_I2_OVAL as example } from "@/lib/fda/fixtures";

const FLYNN_URL = "https://pubmed.ncbi.nlm.nih.gov/12688437/";
const KESSELHEIM_URL = "https://pubmed.ncbi.nlm.nih.gov/25023248/";

const steps = [
  { Icon: Camera, title: "Photo of your label", body: "The sticker your pharmacy put on the bottle." },
  { Icon: Pill, title: "Photo of one pill", body: "On a plain surface, letters facing up." },
  {
    Icon: ScanSearch,
    title: "We check it against the FDA",
    body: "Imprint, color and shape, compared with the FDA record. Size is shown for reference.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      <section className="grid grid-cols-1 items-center gap-12 pt-10 pb-6 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:pt-20">
        <div className="min-w-0 max-w-[38rem]">
          <h1 className="text-4xl font-bold tracking-[-0.025em] text-balance text-ink sm:text-[3.5rem] sm:leading-[1.04]">
            Is this the right pill?
          </h1>
          <p className="mt-5 text-xl text-pretty text-ink sm:text-2xl sm:leading-snug">
            US pharmacies fill about 1.7% of prescriptions with an error. That&apos;s around{" "}
            <strong className="font-bold">51.5 million mistakes a year</strong>.{" "}
            <a
              href={FLYNN_URL}
              target="_blank"
              rel="noreferrer"
              className="text-lg whitespace-nowrap text-ink-soft underline decoration-amber decoration-2 underline-offset-4 hover:text-ink"
            >
              Flynn et al., 2003
            </a>
          </p>
          <p className="mt-4 text-lg text-pretty text-ink-soft">
            Take a photo of your label and one pill. Second Look tells you if the pill matches the FDA record for
            your medicine.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/check" size="lg">
              <Camera aria-hidden />
              Check a bottle
            </ButtonLink>
            <ButtonLink href="/samples" size="lg" variant="secondary">
              Try a sample bottle
            </ButtonLink>
          </div>
          <Link href="/type" className="mt-4 inline-flex min-h-12 items-center rounded-full text-base font-semibold text-ink-soft underline decoration-amber decoration-2 underline-offset-4">No camera? Type what&apos;s on your pill</Link>
        </div>

        {/* The product itself: what a real FDA record looks like, drawn to scale. */}
        <figure className="min-w-0 rounded-[var(--radius-photo)] bg-white p-6 shadow-[var(--shadow-lift)] sm:p-8">
          <figcaption className="text-xl font-bold text-ink">Try a sample bottle</figcaption>
          <p className="mt-2 text-base text-ink-soft">Follow a pill from its label to the FDA evidence.</p>
          <div className="mt-2 grid place-items-center rounded-[var(--radius-card)] bg-foil px-4 py-10">
            <PillDrawing
              shapeCode={example.shapeCode}
              colorCodes={example.colorCodes}
              sizeMm={example.sizeMm}
              imprintSides={example.imprintSides}
              score={example.score}
              pxPerMm={14}
              ruler
            />
          </div>
          <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-xl font-bold text-ink">
              {example.drug} <span className="font-mono whitespace-nowrap">{example.strength}</span>
            </p>
            <p className="text-base text-ink-soft">{example.labeler}</p>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {[
              ["Imprint", example.imprintSides.join(" / "), true],
              ["Color", colorNames(example.colorCodes), false],
              ["Shape", shapeName(example.shapeCode), false],
              ["Size", `${example.sizeMm} mm`, true],
            ].map(([k, v, mono]) => (
              <div key={String(k)} className="rounded-[var(--radius-row)] bg-label px-1 py-2.5">
                <dt className="text-sm text-ink-soft">{k}</dt>
                <dd className={mono ? "font-mono text-lg font-bold whitespace-nowrap text-ink" : "text-lg font-bold text-ink"}>{v}</dd>
              </div>
            ))}
          </dl>
          <SourceBadge setid={example.setid} publishedDate={example.publishedDate} className="mt-5" />
          <ButtonLink href="/samples/match?live=1" size="lg" className="mt-6 w-full px-4 whitespace-normal text-center">Run the sample check</ButtonLink>
          <Link href="/samples" className="mt-3 flex min-h-12 items-center justify-center rounded-full text-base font-semibold text-ink-soft underline underline-offset-4">See all three bottles</Link>
        </figure>
      </section>

      {RESEARCH_RESULTS && <p className="mt-10 max-w-3xl text-base text-ink-soft"><Link href="/research" className="rounded-md underline decoration-amber decoration-2 underline-offset-4">{researchHeadline(RESEARCH_RESULTS)} Read the test.</Link></p>}

      <section aria-labelledby="how" className="mt-16 sm:mt-24">
        <h2 id="how" className="text-2xl font-bold tracking-[-0.01em] text-ink">
          How a check works
        </h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map(({ Icon, title, body }, i) => (
            <li key={title} className="flex gap-4 rounded-[var(--radius-card)] bg-foil p-5 sm:p-6 md:flex-col">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-ink shadow-[var(--shadow-soft)]">
                <Icon className="size-6" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-soft">{i + 1}</p>
                <p className="text-lg font-bold text-ink">{title}</p>
                <p className="mt-1 text-base text-ink-soft">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16 max-w-[44rem] sm:mt-20">
        <h2 className="text-2xl font-bold tracking-[-0.01em] text-ink">When a refill looks different</h2>
        <p className="mt-3 text-lg text-pretty text-ink">
          After a heart attack, people whose pills changed color had 34% higher odds of stopping their medicine. A
          change in shape: 66%.{" "}
          <a
            href={KESSELHEIM_URL}
            target="_blank"
            rel="noreferrer"
            className="whitespace-nowrap text-ink-soft underline decoration-amber decoration-2 underline-offset-4 hover:text-ink"
          >
            Kesselheim et al., 2014
          </a>
        </p>
        <p className="mt-3 text-lg text-pretty text-ink-soft">
          Often it&apos;s the same medicine from a different company. Second Look tells you when that&apos;s the case,
          so you don&apos;t have to guess.
        </p>
      </section>
    </div>
  );
}

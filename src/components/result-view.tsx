import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { CopyScript } from "@/components/copy-script";
import { FeatureTable } from "@/components/feature-table";
import { PillDrawing, type PillHighlight } from "@/components/pill-drawing";
import { RxNormBadge, SourceBadge } from "@/components/source-badge";
import { VerdictField } from "@/components/verdict-field";
import type { CheckResult } from "@/lib/check-service";
import { productName } from "@/lib/fda/concept";
import { formatDate } from "@/lib/fda/fixtures";
import type { Product } from "@/lib/fda/types";
import { displayImprint } from "@/lib/match/imprint";
import { readingAppearance } from "@/lib/match/reading";
import { cn } from "@/lib/utils";

const PX = 11; // px per mm, shared by both drawings so they compare to size

function ProductPill({
  p,
  highlight,
  px = PX,
}: {
  p: Product;
  highlight?: PillHighlight;
  px?: number;
}) {
  return (
    <PillDrawing
      shapeCode={p.shapeCode ?? ""}
      colorCodes={p.colorCodes}
      sizeMm={p.sizeMm ?? 12}
      imprintSides={displayImprint(p.imprintRaw).split(" / ").filter(Boolean)}
      score={p.scored ? 2 : 1}
      highlight={highlight}
      pxPerMm={px}
    />
  );
}

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "flex flex-col rounded-[var(--radius-photo)] bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5",
        className,
      )}
    >
      <figcaption className="text-base font-bold text-ink">{title}</figcaption>
      {children}
    </figure>
  );
}

function Well({ children }: { children: ReactNode }) {
  return (
    <div className="result-well mt-3 grid min-h-44 place-items-center rounded-[var(--radius-card)] px-3 py-6 sm:min-h-52">
      {children}
    </div>
  );
}

function Maker({ p }: { p: Product }) {
  return (
    <p className="text-base text-ink-soft">
      {p.labeler ?? "Maker not listed"} ·{" "}
      <span className="font-mono whitespace-nowrap">NDC {p.ndc9}</span>
    </p>
  );
}

function Chip({
  children,
  tone = "foil",
}: {
  children: ReactNode;
  tone?: "foil" | "amber";
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit rounded-full px-3 py-1 text-sm font-semibold",
        tone === "amber"
          ? "bg-[color-mix(in_srgb,var(--amber)_22%,white)] text-ink"
          : "bg-foil text-ink",
      )}
    >
      {children}
    </span>
  );
}

export function instructionFor(r: CheckResult) {
  if (r.verdict === "MATCH" && r.matchedProduct) {
    return `This pill matches the FDA record for ${productName(r.matchedProduct)}.`;
  }
  if (r.verdict === "SAME_MEDICINE_DIFFERENT_MAKER" && r.matchedProduct) {
    return `Made by ${r.matchedProduct.labeler ?? "another company"}. Same medicine and strength as your label.`;
  }
  if (r.verdict === "MISMATCH" && r.identifiedAs) {
    return `This imprint belongs to ${productName(r.identifiedAs).toLowerCase()}. Don't take it. Call your pharmacy.`;
  }
  return undefined;
}

export function ResultView({
  result: r,
  photo,
  otherPhoto,
  explanation,
}: {
  result: CheckResult;
  photo?: string;
  otherPhoto?: string;
  explanation?: { summary: string; pharmacyScript: string };
}) {
  const reference = r.matchedProduct ?? r.expected;
  const look = readingAppearance(r.pill);
  const read = r.pill.imprintSides.map((s) => s.trim()).filter(Boolean);
  const labelMeta = (p: Product | null | undefined) =>
    p?.setId ? r.labels[p.setId] : undefined;
  const rxnorm = r.evidence.find((e) => e.source === "NLM RxNorm");
  const dailymed = r.evidence.filter(
    (e) => e.source === "FDA DailyMed" && e.setId,
  );
  const roleText = {
    label: "Your label's FDA record",
    matched: "The record your pill matches",
    identified: "What this pill is",
    drug: "",
  };

  return (
    <article className="result-view flex flex-col gap-5 sm:gap-6" aria-label="Check result">
      <VerdictField verdict={r.verdict} instruction={instructionFor(r)} />

      <div className="result-comparison grid gap-4 sm:grid-cols-2">
        <Panel title="What the FDA says it should look like">
          <Well>
            {reference ? (
              <ProductPill p={reference} highlight={r.highlight} />
            ) : (
              <p className="text-center text-base text-ink-soft">
                No FDA record to show
              </p>
            )}
          </Well>
          {reference && (
            <div className="mt-4 flex flex-col gap-1.5">
              <p className="text-lg leading-snug font-bold text-ink">
                {productName(reference)}
              </p>
              <Maker p={reference} />
              <div className="mt-1 flex flex-wrap gap-2">
                {r.expectedIsTypical && !r.matchedProduct && (
                  <Chip>Most common look</Chip>
                )}
                {!reference.active && <Chip tone="amber">No longer made</Chip>}
              </div>
            </div>
          )}
        </Panel>

        <Panel title="What's in your bottle">
          <Well>
            {photo && otherPhoto ? (
              <div className="grid grid-cols-2 gap-3">
                {[photo, otherPhoto].map((src, i) => (
                  <figure key={i}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={
                        i === 0
                          ? "Your pill, first side"
                          : "Your pill, other side"
                      }
                      className="max-h-48 w-full rounded-[var(--radius-row)] object-contain"
                    />
                    <figcaption className="mt-2 text-center text-base">
                      {i === 0 ? "First side" : "Other side"}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt="Your pill photo"
                className="max-h-56 rounded-[var(--radius-row)] object-contain"
              />
            ) : (
              <PillDrawing
                shapeCode={look.shapeCode}
                colorCodes={look.colorCodes}
                sizeMm={reference?.sizeMm ?? 12}
                imprintSides={read}
                highlight={r.highlight}
                pxPerMm={PX}
              />
            )}
          </Well>
          <div className="mt-4 flex flex-col gap-1.5">
            <p className="text-lg leading-snug font-bold text-ink">
              {read.length ? (
                <span className="font-mono">{read.join(" / ")}</span>
              ) : (
                "No letters seen"
              )}
            </p>
            <p className="text-base text-ink-soft">
              {photo
                ? "As read from your photo."
                : "From the pill details supplied."}{" "}
              Size isn&apos;t measured.
            </p>
          </div>
        </Panel>
      </div>

      {r.verdict === "SAME_MEDICINE_DIFFERENT_MAKER" &&
        r.labelProduct &&
        r.matchedProduct && (
          <section className="flex flex-col gap-4 rounded-[var(--radius-photo)] bg-[#eef9fb] p-5 sm:flex-row sm:items-center sm:p-6">
            <div className="grid shrink-0 place-items-center rounded-[var(--radius-card)] bg-white px-4 py-4 shadow-[var(--shadow-soft)]">
              <ProductPill p={r.labelProduct} px={7} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">
                Why it looks different
              </h2>
              <p className="mt-1 text-base text-pretty text-ink">
                Your label lists <strong>{productName(r.labelProduct)}</strong>{" "}
                by {r.labelProduct.labeler}, which looks like this. Your pill is
                the version made by <strong>{r.matchedProduct.labeler}</strong>.
                Pharmacies switch makers often. The medicine and strength are
                the same.
              </p>
            </div>
          </section>
        )}

      {r.verdict === "MISMATCH" && (
        <section className="rounded-[var(--radius-photo)] bg-[color-mix(in_srgb,var(--mismatch)_7%,white)] p-5 sm:p-6">
          {r.identifiedAs ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="grid shrink-0 place-items-center rounded-[var(--radius-card)] bg-white px-4 py-4 shadow-[var(--shadow-soft)]">
                <ProductPill p={r.identifiedAs} px={7} />
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-base font-semibold text-ink-soft">
                  This imprint belongs to
                </p>
                <p className="text-2xl leading-tight font-bold text-ink">
                  {productName(r.identifiedAs)}
                </p>
                <Maker p={r.identifiedAs} />
                {r.identifiedAs.setId && (
                  <SourceBadge
                    setid={r.identifiedAs.setId}
                    publishedDate={labelMeta(r.identifiedAs)?.publishedDate}
                    className="mt-1 self-start"
                  />
                )}
              </div>
            </div>
          ) : (
            <p className="text-lg text-ink">
              We couldn&apos;t confirm what this pill is from FDA records.
              Don&apos;t take it, and show it to your pharmacist.
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="features-h">
        <h2 id="features-h" className="text-xl font-bold text-ink">
          Feature by feature
        </h2>
        <FeatureTable rows={r.features} className="mt-2" />
      </section>

      {r.reasons.length > 0 && (
        <section
          aria-labelledby="why-h"
          className="rounded-[var(--radius-photo)] bg-foil p-5 sm:p-6"
        >
          <h2 id="why-h" className="text-xl font-bold text-ink">
            Why we said this
          </h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {r.reasons.map((reason) => (
              <li
                key={reason}
                className="flex gap-3 text-base text-pretty text-ink"
              >
                <ArrowRight
                  className="mt-1 size-4 shrink-0 text-ink-soft"
                  aria-hidden
                />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="src-h">
        <h2 id="src-h" className="text-xl font-bold text-ink">
          Where this comes from
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {dailymed.map((e) => (
            <li key={e.setId} className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-ink-soft">
                {roleText[e.role]}
              </span>
              <SourceBadge
                setid={e.setId!}
                publishedDate={r.labels[e.setId!]?.publishedDate}
                className="self-start"
              />
            </li>
          ))}
          {rxnorm && (
            <li className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-ink-soft">
                Every maker of this medicine
              </span>
              <RxNormBadge
                href={rxnorm.url}
                text={`${r.productsCompared} products compared`}
                className="self-start"
              />
            </li>
          )}
        </ul>
        <p className="mt-4 text-base text-ink-soft">
          Checked against FDA data on {formatDate(r.checkedAt.slice(0, 10))}.
        </p>
      </section>
      {explanation && (
        <section className="result-script rounded-[var(--radius-photo)] p-6 sm:p-8" aria-labelledby="explanation-h">
          <h2 id="explanation-h" className="text-xl font-semibold text-ink">In plain words</h2>
          <p className="mt-3 text-base text-ink-soft">{explanation.summary}</p>
          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-base"><strong className="font-semibold">What to say when you call your pharmacy</strong><br/>{explanation.pharmacyScript}</p>
            <CopyScript text={explanation.pharmacyScript}/>
          </div>
        </section>
      )}
    </article>
  );
}

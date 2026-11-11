/* eslint-disable @next/next/no-img-element */
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/button";
import type { Metadata } from "next";
import Link from "next/link";
import { PillDrawing } from "@/components/pill-drawing";
import { instructionFor } from "@/components/result-view";
import { SourceBadge } from "@/components/source-badge";
import { VerdictField } from "@/components/verdict-field";
import { productName } from "@/lib/fda/concept";
import { formatDate } from "@/lib/fda/fixtures";
import { DEMO_RECORDED_ON as RECORDED_ON } from "@/lib/sample-results";
import type { Product } from "@/lib/fda/types";
import { displayImprint } from "@/lib/match/imprint";
import { SAMPLES } from "@/lib/samples";

export const metadata: Metadata = { title: "Sample bottles" };

const PX = 9; // same scale on every card so the pills compare to size

function PillSlot({ caption, p }: { caption: string; p: Product | null | undefined }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-semibold text-ink-soft">{caption}</figcaption>
      <div className="grid min-h-48 place-items-center rounded-[var(--radius-card)] bg-white px-2 py-6">
        {p ? (
          <PillDrawing
            shapeCode={p.shapeCode ?? ""}
            colorCodes={p.colorCodes}
            sizeMm={p.sizeMm ?? 12}
            imprintSides={displayImprint(p.imprintRaw).split(" / ").filter(Boolean)}
            score={p.scored ? 2 : 1}
            pxPerMm={PX}
          />
        ) : (
          <span className="text-base text-ink-soft">No record</span>
        )}
      </div>
      {p && <p className="text-base leading-snug font-semibold text-ink">{productName(p)}</p>}
    </figure>
  );
}

export default function SamplesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-10 sm:px-8 sm:pt-14">
      <div className="max-w-[40rem]">
        <h1 className="text-4xl font-bold tracking-[-0.025em] text-ink">Sample bottles</h1>
        <p className="mt-4 text-lg text-pretty text-ink-soft">
          See how a matching pill, a different maker, and a wrong pill compare. Each saved result comes from our checker and real FDA records. Demo patient details are made up.
        </p>
      </div>

      <ul className="sample-grid mt-12 grid gap-8 lg:grid-cols-3">
        {SAMPLES.map(({ scenario: s, result: r, photos, recordedAt }) => {
          const labelSays = r.labelProduct ?? r.expected;
          const inBottle = r.verdict === "MISMATCH" ? r.identifiedAs : r.matchedProduct;
          const source = labelSays?.setId ? r.labels[labelSays.setId] : undefined;
          return (
            <li
              key={s.id}
              className="flex flex-col gap-5 rounded-[var(--radius-photo)] bg-white p-5 shadow-[var(--shadow-lift)] sm:p-6"
            >
              <h2 className="text-2xl font-bold tracking-[-0.01em] text-ink">{s.title}</h2>
              {photos ? <div className="grid grid-cols-2 gap-2"><img src={photos.label} alt="Made-up pharmacy label" className="aspect-square w-full rounded-[var(--radius-row)] bg-foil object-contain" /><img src={photos.pill} alt="Real sample pill" className="aspect-square w-full rounded-[var(--radius-row)] bg-foil object-contain" /></div> : <p className="text-base text-ink-soft">Recorded FDA example · {formatDate(RECORDED_ON)}. This bottle has no demo photos yet.</p>}
              {photos && <p className="text-sm text-ink-soft">Photo check saved {formatDate(recordedAt)}</p>}
              <div className="grid grid-cols-2 gap-3">
                <PillSlot caption="Your label says" p={labelSays} />
                <PillSlot caption="In the bottle" p={inBottle} />
              </div>
              <VerdictField verdict={r.verdict} instruction={instructionFor(r)} compact />
              <div className="mt-auto flex flex-col gap-3">
                <ButtonLink href={`/samples/${s.id}?live=1`} className="w-full" size="lg">Run this check live</ButtonLink>
                {labelSays?.setId && <SourceBadge setid={labelSays.setId} publishedDate={source?.publishedDate} />}
                <Link
                  href={`/samples/${s.id}`}
                  className="flex min-h-12 items-center gap-2 self-start rounded-full text-base font-semibold text-ink underline-offset-4 hover:underline"
                >
                  See the full check
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

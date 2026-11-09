import { ArrowRight, Camera } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PillDrawing } from "@/components/pill-drawing";
import { instructionFor } from "@/components/result-view";
import { SourceBadge } from "@/components/source-badge";
import { VerdictField } from "@/components/verdict-field";
import { productName } from "@/lib/fda/concept";
import { formatDate } from "@/lib/fda/fixtures";
import { RECORDED_ON } from "@/lib/fda/recorded";
import type { Product } from "@/lib/fda/types";
import { displayImprint } from "@/lib/match/imprint";
import { SAMPLE_RESULTS } from "@/lib/sample-results";

export const metadata: Metadata = { title: "Sample bottles" };

const PX = 9; // same scale on every card so the pills compare to size

function PillSlot({ caption, p }: { caption: string; p: Product | null | undefined }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-semibold text-ink-soft">{caption}</figcaption>
      <div className="grid min-h-32 place-items-center rounded-[var(--radius-card)] bg-foil px-2 py-4">
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
          Three bottles we set up to show each kind of result. Each verdict below comes from our real checker run on
          FDA records saved on {formatDate(RECORDED_ON)}. The patient names on the labels are made up.
        </p>
      </div>

      <ul className="mt-10 grid gap-6 lg:grid-cols-3">
        {SAMPLE_RESULTS.map(({ scenario: s, result: r }) => {
          const labelSays = r.labelProduct ?? r.expected;
          const inBottle = r.verdict === "MISMATCH" ? r.identifiedAs : r.matchedProduct;
          const source = labelSays?.setId ? r.labels[labelSays.setId] : undefined;
          return (
            <li
              key={s.id}
              className="flex flex-col gap-5 rounded-[var(--radius-photo)] bg-white p-5 shadow-[var(--shadow-lift)] sm:p-6"
            >
              <h2 className="text-2xl font-bold tracking-[-0.01em] text-ink">{s.title}</h2>
              <div className="grid aspect-[16/10] place-items-center rounded-[var(--radius-photo)] bg-foil text-ink-soft">
                <span className="flex flex-col items-center gap-2 text-base">
                  <Camera className="size-7" aria-hidden />
                  Bottle photo coming soon
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <PillSlot caption="Your label says" p={labelSays} />
                <PillSlot caption="In the bottle" p={inBottle} />
              </div>
              <VerdictField verdict={r.verdict} instruction={instructionFor(r)} compact />
              <div className="mt-auto flex flex-col gap-3">
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

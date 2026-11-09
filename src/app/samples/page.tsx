import { ArrowRight, Camera } from "lucide-react";
import type { Metadata } from "next";
import { PillDrawing } from "@/components/pill-drawing";
import { SourceBadge } from "@/components/source-badge";
import { VerdictField } from "@/components/verdict-field";
import { ACETAMINOPHEN_L484, ADVIL_OVAL, IBUPROFEN_I2_OVAL, type FdaProduct } from "@/lib/fda/fixtures";
import type { Verdict } from "@/lib/verdict";

export const metadata: Metadata = { title: "Sample bottles" };

type Sample = {
  id: string;
  title: string;
  verdict: Verdict;
  instruction?: string;
  labelSays: FdaProduct;
  inBottle: FdaProduct;
};

// Our three real demo bottles (ARCHITECTURE.md). Photos arrive in phase 3; the FDA records are real now.
const SAMPLES: Sample[] = [
  {
    id: "match",
    title: "The right pill",
    verdict: "MATCH",
    labelSays: IBUPROFEN_I2_OVAL,
    inBottle: IBUPROFEN_I2_OVAL,
  },
  {
    id: "different-maker",
    title: "Same medicine, new look",
    verdict: "SAME_MEDICINE_DIFFERENT_MAKER",
    labelSays: ADVIL_OVAL,
    inBottle: IBUPROFEN_I2_OVAL,
  },
  {
    id: "mismatch",
    title: "The wrong pill",
    verdict: "MISMATCH",
    instruction: "This imprint belongs to acetaminophen 500 mg. Don't take it. Call your pharmacy.",
    labelSays: IBUPROFEN_I2_OVAL,
    inBottle: ACETAMINOPHEN_L484,
  },
];

const PX = 9; // same scale on every card so the pills compare to size

function PillSlot({ caption, p }: { caption: string; p: FdaProduct }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-semibold text-ink-soft">{caption}</figcaption>
      <div className="grid min-h-32 place-items-center rounded-[var(--radius-card)] bg-foil px-2 py-4">
        <PillDrawing
          shapeCode={p.shapeCode}
          colorCodes={p.colorCodes}
          sizeMm={p.sizeMm}
          imprintSides={p.imprintSides}
          score={p.score}
          pxPerMm={PX}
        />
      </div>
      <p className="text-base leading-snug font-semibold text-ink">
        {p.drug} <span className="font-mono whitespace-nowrap">{p.strength}</span>
      </p>
    </figure>
  );
}

export default function SamplesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-10 sm:px-8 sm:pt-14">
      <div className="max-w-[40rem]">
        <h1 className="text-4xl font-bold tracking-[-0.025em] text-ink">Sample bottles</h1>
        <p className="mt-4 text-lg text-pretty text-ink-soft">
          Three bottles we set up to show each kind of result. The pills and FDA records are real. The patient names
          on the labels are made up.
        </p>
      </div>

      <ul className="mt-10 grid gap-6 lg:grid-cols-3">
        {SAMPLES.map((s) => (
          <li key={s.id} className="flex flex-col gap-5 rounded-[var(--radius-photo)] bg-white p-5 shadow-[var(--shadow-lift)] sm:p-6">
            <h2 className="text-2xl font-bold tracking-[-0.01em] text-ink">{s.title}</h2>
            <div className="grid aspect-[16/10] place-items-center rounded-[var(--radius-photo)] bg-foil text-ink-soft">
              <span className="flex flex-col items-center gap-2 text-base">
                <Camera className="size-7" aria-hidden />
                Bottle photo coming soon
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <PillSlot caption="Your label says" p={s.labelSays} />
              <PillSlot caption="In the bottle" p={s.inBottle} />
            </div>
            <VerdictField verdict={s.verdict} instruction={s.instruction} compact />
            <div className="mt-auto flex flex-col gap-3">
              <SourceBadge setid={s.labelSays.setid} publishedDate={s.labelSays.publishedDate} />
              <p className="flex items-center gap-2 text-base text-ink-soft">
                <ArrowRight className="size-4" aria-hidden />
                Full sample check coming soon
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

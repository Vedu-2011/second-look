import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Button } from "@/components/button";
import { CheckingSteps } from "@/components/checking-steps";
import { FeatureTable } from "@/components/feature-table";
import { PillDrawing } from "@/components/pill-drawing";
import { SourceBadge } from "@/components/source-badge";
import { StepIndicator } from "@/components/step-indicator";
import { VerdictField } from "@/components/verdict-field";
import { COLOR_CODES, SHAPE_CODES, colorNames, shapeName } from "@/lib/fda/codes";
import { ADVIL_OVAL, FIXTURES, IBUPROFEN_I2_OVAL, IBUPROFEN_I2_ROUND, OMEPRAZOLE_CAPSULE } from "@/lib/fda/fixtures";
import { pillGeometry } from "@/lib/pill";
import { VERDICTS } from "@/lib/verdict";

// Internal design gallery: every component and verdict state, for screenshots and review.
export const metadata: Metadata = { title: "Style", robots: { index: false } };

const TOKENS = [
  ["--ink", "#1D1D1F", "Text, icons"],
  ["--bg", "#FFFFFF", "Page background"],
  ["--bg-soft", "#F5F5F7", "Section background"],
  ["--brand", "#FF9500", "Brand, primary action"],
  ["--match", "#1F7A3A", "Verdict: matches"],
  ["--same", "#0E6F80", "Verdict: same medicine"],
  ["--mismatch", "#C9241A", "Verdict: doesn't match"],
  ["--unsure", "#3A3A3C", "Verdict: can't tell"],
] as const;

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mt-16">
      <h2 className="text-2xl font-bold tracking-[-0.01em] text-ink">{title}</h2>
      {note && <p className="mt-1 max-w-[44rem] text-base text-ink-soft">{note}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

const SCALE = 12; // px per mm, shared so the gallery pills compare to size

export default function StylePage() {
  const realPills = [IBUPROFEN_I2_ROUND, IBUPROFEN_I2_OVAL, ADVIL_OVAL];
  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-10 sm:px-8 sm:pt-14">
      <h1 className="text-4xl font-bold tracking-[-0.025em] text-ink">Design gallery</h1>
      <p className="mt-3 max-w-[40rem] text-lg text-ink-soft">
        Every component and state, built from docs/DESIGN.md. The pills are drawn from real FDA records.
      </p>

      <Section title="The drawn pill" note={`Real FDA records from RxNav, drawn to the same scale (${SCALE} px per mm).`}>
        <ul className="grid gap-5 md:grid-cols-3">
          {realPills.map((p) => (
            <li key={p.id} className="flex flex-col rounded-[var(--radius-photo)] bg-white p-5 shadow-[var(--shadow-soft)]">
              <div className="grid min-h-56 place-items-center rounded-[var(--radius-card)] bg-white p-4">
                <PillDrawing
                  shapeCode={p.shapeCode}
                  colorCodes={p.colorCodes}
                  sizeMm={p.sizeMm}
                  imprintSides={p.imprintSides}
                  score={p.score}
                  pxPerMm={SCALE}
                  ruler
                />
              </div>
              <p className="mt-4 text-lg font-bold text-ink">
                {p.drug} <span className="font-mono whitespace-nowrap">{p.strength}</span>
              </p>
              <p className="text-base text-ink-soft">{p.labeler}</p>
              <p className="mt-2 font-mono text-base text-ink">
                {p.imprintSides.join(";")} · {colorNames(p.colorCodes)} · {shapeName(p.shapeCode)} · {p.sizeMm} mm
              </p>
              <p className="font-mono text-sm text-ink-soft">NDC {p.ndc}</p>
              <SourceBadge setid={p.setid} publishedDate={p.publishedDate} className="mt-4 self-start" />
            </li>
          ))}
        </ul>

        <h3 className="mt-10 text-xl font-bold text-ink">Highlighting the feature that doesn&apos;t match</h3>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {(["imprint", "color", "shape"] as const).map((h) => (
            <figure key={h} className="grid place-items-center gap-2 rounded-[var(--radius-card)] bg-white p-4">
              <PillDrawing
                shapeCode={IBUPROFEN_I2_OVAL.shapeCode}
                colorCodes={IBUPROFEN_I2_OVAL.colorCodes}
                sizeMm={IBUPROFEN_I2_OVAL.sizeMm}
                imprintSides={IBUPROFEN_I2_OVAL.imprintSides}
                highlight={h}
                pxPerMm={10}
              />
              <figcaption className="text-base font-semibold text-ink">{h[0].toUpperCase() + h.slice(1)}</figcaption>
            </figure>
          ))}
          <figure className="grid place-items-center gap-2 rounded-[var(--radius-card)] bg-white p-4">
            <PillDrawing
              shapeCode={OMEPRAZOLE_CAPSULE.shapeCode}
              colorCodes={OMEPRAZOLE_CAPSULE.colorCodes}
              sizeMm={OMEPRAZOLE_CAPSULE.sizeMm}
              imprintSides={OMEPRAZOLE_CAPSULE.imprintSides}
              pxPerMm={10}
            />
            <figcaption className="text-center text-base font-semibold text-ink">
              Two-tone capsule <span className="font-mono">57S</span>
            </figcaption>
          </figure>
        </div>

        <h3 className="mt-10 text-xl font-bold text-ink">Every FDA shape</h3>
        <p className="mt-1 text-base text-ink-soft">
          Shape test only, not real products. Shapes without their own drawing fall back to round (marked).
        </p>
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
          {Object.entries(SHAPE_CODES).map(([code, s], i) => {
            const colors = Object.keys(COLOR_CODES);
            return (
              <li key={code} className="flex flex-col items-center gap-1.5 rounded-[var(--radius-row)] bg-white px-2 py-3 text-center">
                <PillDrawing
                  shapeCode={code}
                  colorCodes={[colors[i % colors.length]]}
                  sizeMm={11}
                  imprintSides={[]}
                  pxPerMm={6}
                />
                <span className="text-sm font-semibold text-ink">{s.name}</span>
                {pillGeometry(code, 11).fallback && <span className="text-xs text-ink-soft">drawn round</span>}
                <span className="font-mono text-xs text-ink-soft">{code}</span>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Verdicts" note="Color, icon, word and instruction, so every verdict reads without color.">
        <div className="flex max-w-[45rem] flex-col gap-4">
          {VERDICTS.map((v) => (
            <VerdictField key={v} verdict={v} />
          ))}
        </div>
      </Section>

      <Section title="Feature table" note="Failing row tinted. Imprint and size in mono.">
        <div className="grid max-w-[60rem] gap-8 lg:grid-cols-2">
          <FeatureTable
            rows={[
              { name: "Imprint", expected: "I2", found: "I2", result: "match" },
              { name: "Color", expected: "Orange", found: "Orange", result: "match" },
              { name: "Shape", expected: "Oval", found: "Oval", result: "match" },
              { name: "Size", expected: "15 mm", found: "15 mm", result: "match" },
            ]}
          />
          <FeatureTable
            rows={[
              { name: "Imprint", expected: "I2", found: "L484", result: "mismatch" },
              { name: "Color", expected: "Orange", found: "White", result: "mismatch" },
              { name: "Shape", expected: "Oval", found: "Oval", result: "match" },
              { name: "Size", expected: "15 mm", found: "about 16 mm", result: "unsure" },
            ]}
          />
        </div>
      </Section>

      <Section title="Checking steps" note="Waiting, working, done, failed. With reduced motion the spinner stands still.">
        <div className="grid max-w-[60rem] gap-6 lg:grid-cols-2">
          <CheckingSteps states={["done", "done", "working", "waiting"]} className="rounded-[var(--radius-photo)] bg-foil p-2" />
          <CheckingSteps states={["done", "failed", "waiting", "waiting"]} className="rounded-[var(--radius-photo)] bg-foil p-2" />
        </div>
      </Section>

      <Section title="Step indicator">
        <div className="grid max-w-[60rem] gap-8 sm:grid-cols-2">
          <StepIndicator step={1} title="Photo of the label" />
          <StepIndicator step={2} title="Photo of one pill" />
        </div>
      </Section>

      <Section title="Buttons" note="Pill-shaped. Every size is at least 48px tall.">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg">Check my pill</Button>
          <Button>Take label photo</Button>
          <Button variant="secondary">Upload a photo</Button>
          <Button variant="ink">Copy what to say</Button>
          <Button variant="ghost">Back</Button>
          <Button disabled>Not yet</Button>
        </div>
      </Section>

      <Section title="Source badge">
        <SourceBadge setid={ADVIL_OVAL.setid} publishedDate={ADVIL_OVAL.publishedDate} />
      </Section>

      <Section title="Color">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {TOKENS.map(([name, hex, use]) => (
            <li key={name} className="overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)]">
              <div className="h-20" style={{ background: `var(${name})` }} />
              <div className="p-3">
                <p className="font-mono text-sm font-bold text-ink">{name}</p>
                <p className="font-mono text-sm text-ink-soft">{hex}</p>
                <p className="mt-1 text-sm text-ink-soft">{use}</p>
              </div>
            </li>
          ))}
        </ul>
        <h3 className="mt-8 text-xl font-bold text-ink">Pill display colors (one per FDA color code)</h3>
        <ul className="mt-4 flex flex-wrap gap-3">
          {Object.entries(COLOR_CODES).map(([code, c]) => (
            <li key={code} className="flex items-center gap-2 rounded-full bg-white py-1.5 pr-4 pl-1.5 shadow-[var(--shadow-soft)]">
              <span className="size-8 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]" style={{ background: c.hex }} />
              <span className="text-sm font-semibold text-ink">{c.name}</span>
              <span className="font-mono text-xs text-ink-soft">{code}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type" note="SF system type with Inter fallback. Atkinson Hyperlegible Mono only for imprints, NDCs and strengths.">
        <div className="flex flex-col gap-3">
          <p className="text-verdict font-bold tracking-[-0.02em] text-ink">Doesn&apos;t match</p>
          <p className="text-4xl font-bold text-ink">Is this the right pill?</p>
          <p className="text-2xl font-bold text-ink">How a check works</p>
          <p className="text-lg text-ink">Clear body text, 17px on phones and 19px on laptops.</p>
          <p className="font-mono text-2xl font-bold text-ink">I2 · L484 · 0O 1Il 5S 8B 2Z · NDC 0113-0517 · 200 mg</p>
        </div>
      </Section>

      <p className="mt-16 text-sm text-ink-soft">Fixtures: {FIXTURES.map((f) => f.ndc).join(", ")} (RxNav, Nov 8, 2026).</p>
    </div>
  );
}

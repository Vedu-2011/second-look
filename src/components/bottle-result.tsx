"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, HelpCircle, RotateCcw, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/button";
import { pixelCrop } from "@/lib/bottle/overlay";
import type { BottleDecision, BottlePill, BottleResult } from "@/lib/bottle/types";
import { VERDICT_COPY } from "@/lib/verdict";
import { cn } from "@/lib/utils";

/** What the next photo is for, as the words on its button. */
export const NEXT_ACTION: Record<NonNullable<BottleDecision["next"]>, string> = {
  flip: "Flip and snap again",
  flip_and_nudge: "Flip, nudge and snap again",
  nudge: "Nudge apart and snap again",
  pour_again: "Pour again and snap",
};
const state = (p: BottlePill) => p.result.verdict === "MISMATCH" ? "mismatch" : p.faceDown ? "faceDown" : p.odd && p.result.verdict === "UNSURE" ? "odd" : p.result.verdict === "UNSURE" ? "unsure" : p.odd ? "odd" : "match";
const TONE = { mismatch: "bg-mismatch text-white", faceDown: "bg-ink text-white", odd: "bg-amber text-ink", unsure: "bg-ink-soft text-white", match: "bg-match text-white" } as const;
const SYMBOL = { mismatch: "×", faceDown: "↻", odd: "!", unsure: "?", match: "✓" } as const;
const WORD = { mismatch: VERDICT_COPY.MISMATCH.word, faceDown: "Writing face-down", odd: "Looks different", unsure: VERDICT_COPY.UNSURE.word, match: "" } as const;
const word = (p: BottlePill) => WORD[state(p)] || VERDICT_COPY[p.result.verdict].word;

function MiniCrop({ photo, pill }: { photo: string; pill: BottlePill }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const image = new Image(); let active = true;
    image.onload = () => {
      if (!active || !canvas.current) return;
      const crop = pixelCrop(pill.box, image.naturalWidth, image.naturalHeight);
      const out = canvas.current; out.width = crop.width; out.height = crop.height;
      out.getContext("2d")?.drawImage(image, crop.left, crop.top, crop.width, crop.height, 0, 0, crop.width, crop.height);
    };
    image.src = photo;
    return () => { active = false; };
  }, [photo, pill.box]);
  return <canvas ref={canvas} role="img" aria-label={`Your photograph of pill ${pill.number}`} className="max-h-24 w-24 shrink-0 rounded-2xl object-contain" />;
}
export function BottleResultView({ result, photo, shareId, onRetake, onNext }: { result: BottleResult; photo?: string; shareId?: string; onRetake?: () => void; onNext?: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const { decision } = result;
  const clumps = result.clumps ?? [], asks = new Set(decision.asks ?? []);
  const tone = decision.verdict === "MATCH" ? "match" : decision.verdict === "MISMATCH" ? "mismatch" : decision.verdict === "WARNING" ? "warning" : decision.verdict === "FACE_DOWN" ? "calm" : "unsure";
  const Icon = tone === "match" ? Check : tone === "mismatch" ? X : tone === "warning" ? AlertTriangle : tone === "calm" ? RotateCcw : HelpCircle;
  function selectPill(number: number) {
    setSelected(number);
    const row = document.getElementById(`bottle-pill-${number}`);
    row?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    row?.focus({ preventScroll: true });
  }
  const nextLabel = decision.next ? NEXT_ACTION[decision.next] : null;
  return <div className="space-y-8">
    <section aria-labelledby="bottle-verdict" className={cn("rounded-[var(--radius-card)] p-6 shadow-[var(--shadow-soft)] sm:p-8", tone === "match" ? "verdict-match" : tone === "mismatch" ? "verdict-mismatch" : tone === "warning" ? "bg-[#fff3dc]" : tone === "calm" ? "bg-[#eef4fb]" : "bg-foil")}>
      <Icon aria-hidden className={cn("mb-4 size-9", tone === "match" ? "text-match" : tone === "mismatch" ? "text-mismatch" : "text-ink")} />
      <p className="mb-2 text-lg font-semibold text-ink-soft">{result.pills.length} {result.pills.length === 1 ? "pill" : "pills"} found{clumps.length ? ` · ${clumps.length} circled` : ""}</p>
      <h2 id="bottle-verdict" className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{decision.title}</h2>
      <p className="mt-4 text-xl">{decision.instruction}</p>
      {result.followUp && <p className="mt-4 rounded-2xl bg-white/70 p-4 text-lg">{result.followUp.note}</p>}
      {nextLabel && onNext && <Button size="lg" className="mt-6 w-full text-lg sm:w-auto" variant={decision.verdict === "MISMATCH" ? "secondary" : "primary"} onClick={onNext}><RotateCcw aria-hidden />{nextLabel}</Button>}
      <p className="mt-5 text-lg text-ink-soft">This doesn&apos;t replace your pharmacist. We only check pills we can see in the photo.</p>
    </section>
    <section aria-labelledby="bottle-photo-title">
      <h2 id="bottle-photo-title" className="text-2xl font-bold">Is every pill numbered?</h2>
      <p id="bottle-photo-help" className="mt-2 text-lg text-ink-soft">{asks.size ? "Pills to flip have a ring. " : ""}{clumps.length ? "Pills that are touching or cut off are circled; we didn't read those. " : ""}If a pill has no number, give it more space and snap again. Tap a number to see its reading.</p>
      {!photo && <p className="mt-3 rounded-2xl bg-foil p-4 text-lg">Photos are never saved. These numbers keep the original positions on a plain background.</p>}
      <div className="relative mt-5 w-full overflow-hidden rounded-[var(--radius-photo)] bg-foil" style={{ aspectRatio: `${result.image.width} / ${result.image.height}` }} aria-describedby="bottle-photo-help">
        {photo && <img src={photo} alt="Your photo of the pills, with a number on each pill we found" className="absolute inset-0 h-full w-full" />}
        {clumps.map((c, i) => <div key={`clump-${i}`} role="img" aria-label={c.kind === "touching" ? "Circled: pills touching, not read" : "Circled: pill cut off at the edge, not read"} className="pointer-events-none absolute rounded-full border-[3px] border-dashed border-amber shadow-[0_0_0_3px_#fff8]" style={{ left: `${(c.box.x - c.box.width * 0.12) * 100}%`, top: `${(c.box.y - c.box.height * 0.12) * 100}%`, width: `${c.box.width * 124}%`, height: `${c.box.height * 124}%` }} />)}
        {result.pills.filter((p) => asks.has(p.number)).map((p) => <div key={`ring-${p.number}`} aria-hidden className="pointer-events-none absolute rounded-full shadow-[0_0_0_4px_var(--amber),0_0_0_7px_white]" style={{ left: `${p.box.x * 100}%`, top: `${p.box.y * 100}%`, width: `${p.box.width * 100}%`, height: `${p.box.height * 100}%` }} />)}
        {result.pills.map((pill) => {
          const corner = { x: (pill.box.x + pill.box.width) * 100, y: pill.box.y * 100 }, s = state(pill);
          return <button key={pill.number} type="button" onClick={() => selectPill(pill.number)} aria-label={`Pill ${pill.number}: ${word(pill)}${asks.has(pill.number) ? ", flip this one" : ""}. See reading`} style={{ left: `clamp(22px, ${corner.x}%, calc(100% - 22px))`, top: `clamp(22px, ${corner.y}%, calc(100% - 22px))` }} className={cn("absolute grid min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-[0_0_0_3px_white,0_2px_8px_#0004]", TONE[s])}><span className="font-mono text-base font-bold">{pill.number}<span className="ml-0.5 text-xs" aria-hidden>{SYMBOL[s]}</span></span></button>;
        })}
      </div>
      <p className="mt-3 text-lg text-ink-soft">✓ Matches · × Doesn&apos;t match · ↻ Writing face-down · ! Looks different · ? Can&apos;t tell</p>
    </section>
    <section aria-labelledby="bottle-readings"><h2 id="bottle-readings" className="text-2xl font-bold">Every pill we found</h2>
      <ol className="mt-4 space-y-5">{result.pills.map((pill) => <li id={`bottle-pill-${pill.number}`} key={pill.number} tabIndex={-1} className={cn("scroll-mt-28 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-soft)] outline-offset-4", selected === pill.number && "outline-2 outline-ink")}>
        <div className="flex items-start gap-4">
          {photo ? <MiniCrop photo={photo} pill={pill} /> : <span aria-hidden className={cn("grid size-12 shrink-0 place-items-center rounded-full font-bold", TONE[state(pill)])}>{pill.number}</span>}
          <div className="min-w-0"><h3 className="text-xl font-bold">Pill {pill.number}</h3><p className="mt-1 text-lg font-semibold"><span aria-hidden>{SYMBOL[state(pill)]} </span>{word(pill)}{asks.has(pill.number) ? " · flip this one" : ""}{pill.reread ? " · read again" : ""}</p><p className="mt-2 break-words font-mono text-lg">{pill.result.pill.imprintSides.join(" / ") || "No readable imprint"}</p><p className="mt-1 text-lg text-ink-soft">{[pill.result.pill.colors.join(" / "), pill.result.pill.shape].filter(Boolean).join(" · ")}</p></div>
        </div>
        {pill.faceDown && <p className="mt-4 rounded-2xl bg-[#eef4fb] p-4 text-lg">It looks like the pills that matched, but its writing is face-down. That&apos;s not a match yet: flip it where it is and snap again.</p>}
        {pill.odd && <p className="mt-4 rounded-2xl bg-[#fff3dc] p-4 text-lg font-semibold">It is {pill.odd} from the other pills in this photo.</p>}
        {pill.appearanceWarning && <p className="mt-4 rounded-2xl bg-[#fff3dc] p-4 text-lg font-semibold">Looks different: {pill.appearanceWarning}. Check with your pharmacist.</p>}
        <p className="mt-4 text-lg">{pill.result.reasons.join(" ")}</p>
        {pill.result.identifiedAs?.title && <p className="mt-3 text-lg font-semibold">FDA-listed imprint for {pill.result.identifiedAs.title}</p>}
        <details className="mt-4"><summary className="min-h-11 cursor-pointer py-2 text-lg font-semibold text-blue">FDA evidence and comparison</summary>
          <dl className="mt-2 space-y-3 text-lg">{pill.result.features.map((f) => <div key={f.name}><dt className="font-semibold">{f.name}</dt><dd>FDA: {f.expected} · Read: {f.found} ({f.result.replaceAll("_", " ")})</dd></div>)}</dl>
          <ul className="mt-4 space-y-3">{pill.result.evidence.map((e) => <li key={e.url}><a className="break-words text-lg font-semibold text-blue" href={e.url} target="_blank" rel="noreferrer">{e.source}{e.setId ? ` label ${e.setId}` : ""} ↗</a>{e.setId && <p className="text-base text-ink-soft">Published {pill.result.labels[e.setId]?.publishedDate ?? "date unavailable"}</p>}</li>)}</ul>
          <p className="mt-3 text-base text-ink-soft">Checked {new Date(pill.result.checkedAt).toLocaleDateString("en-US", { timeZone: "UTC" })} · {pill.result.productsCompared} FDA products compared</p>
        </details>
      </li>)}</ol>
    </section>
    <div className="flex flex-col gap-3 sm:flex-row">{onRetake && <Button variant="secondary" onClick={onRetake}>Start over with a new photo</Button>}{shareId && <ButtonLink href={`/result/${shareId}`} variant="secondary">Open shareable result</ButtonLink>}<ButtonLink href="/check#one" variant="ghost">Check one pill</ButtonLink></div>
  </div>;
}

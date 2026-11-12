"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, EqualApproximately, HelpCircle, RotateCcw, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/button";
import { layoutPins, pixelCrop } from "@/lib/bottle/overlay";
import type { BottleDecision, BottlePill, BottleResult } from "@/lib/bottle/types";
import { BOTTLE_SYMBOL as SYMBOL, BOTTLE_WORD, bottleDisplayState as state, bottleLegend, bottleSummary, followUpDisplayNote, isRedMode, MARKER_SYMBOL, markerState, mismatchLead, needsAttention, otherPillsLine, type MarkerState } from "@/lib/bottle/display";
import { VERDICT_COPY } from "@/lib/verdict";
import { cn } from "@/lib/utils";

/** What the next photo is for, as the words on its button. */
export const NEXT_ACTION: Record<NonNullable<BottleDecision["next"]>, string> = {
  flip: "Flip and snap again",
  flip_and_nudge: "Flip, nudge and snap again",
  nudge: "Nudge apart and snap again",
  pour_again: "Pour again and snap",
};
const TONE: Record<MarkerState, string> = { dimMatch: "bg-ink-soft/55 text-white", dim: "bg-[#a3a8b0]", mismatch: "bg-mismatch text-white", faceDown: "bg-ink text-white", odd: "bg-amber text-ink", unsure: "bg-ink-soft text-white", match: "bg-match text-white", looksLike: "border-2 border-match/45 bg-[#f2fbf4] text-match", matchedEarlier: "border-2 border-match/45 bg-[#f2fbf4] text-match" } as const;
const box = (b: { x: number; y: number; width: number; height: number }, grow = 0) => ({ left: `${(b.x - b.width * grow) * 100}%`, top: `${(b.y - b.height * grow) * 100}%`, width: `${b.width * (1 + 2 * grow) * 100}%`, height: `${b.height * (1 + 2 * grow) * 100}%` });
const word = (p: BottlePill) => state(p) === "match" ? VERDICT_COPY[p.result.verdict].word : BOTTLE_WORD[state(p)];

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
  const overlay = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = overlay.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setMeasured({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const { decision } = result;
  const allClumps = result.clumps ?? [], asks = new Set(decision.asks ?? []);
  // Dashed circles are only for regions nobody read. A pile we read has numbered pills; a small dark thing at the edge is a note.
  const clumps = allClumps.filter(c => !c.pile && !c.minor), edgeNote = allClumps.some(c => c.minor), piled = result.pills.filter(p => p.fromPile).length;
  const red = isRedMode(result.pills);
  const size = measured && measured.width > 0 ? measured : { width: 375, height: 375 * result.image.height / result.image.width };
  const pinPx = size.width < 560 ? 28 : 32;
  const pins = useMemo(() => layoutPins(result.pills.map(p => p.box), size, pinPx), [result.pills, size.width, size.height, pinPx]); // eslint-disable-line react-hooks/exhaustive-deps
  const tone = decision.verdict === "LOOKS_RIGHT" ? "looksLike" : decision.verdict === "MATCH" ? "match" : decision.verdict === "MISMATCH" ? "mismatch" : decision.verdict === "WARNING" ? "warning" : decision.verdict === "FACE_DOWN" ? "calm" : "unsure";
  const Icon = tone === "looksLike" ? EqualApproximately : tone === "match" ? Check : tone === "mismatch" ? X : tone === "warning" ? AlertTriangle : tone === "calm" ? RotateCcw : HelpCircle;
  const attention = result.pills.filter(needsAttention).sort((a, b) => {
    const priority = (p: BottlePill) => state(p) === "mismatch" ? 0 : p.odd || p.appearanceWarning ? 1 : 2;
    return priority(a) - priority(b) || a.number - b.number;
  });
  const matched = result.pills.filter(p => !needsAttention(p) && state(p) === "match");
  const lookalikes = result.pills.filter(p => state(p) === "looksLike");
  const earlier = result.pills.filter(p => !needsAttention(p) && state(p) === "matchedEarlier");
  const legend = bottleLegend(result.pills, allClumps, red);
  const wrong = attention.filter(p => state(p) === "mismatch"), others = red ? result.pills.filter(p => state(p) !== "mismatch") : [];
  function selectPill(number: number) {
    setSelected(number);
    const row = document.getElementById(`bottle-pill-${number}`);
    const group = row?.closest<HTMLDetailsElement>("details[data-pill-group]");
    if (group) group.open = true;
    row?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    row?.focus({ preventScroll: true });
  }
  const nextLabel = decision.next ? NEXT_ACTION[decision.next] : null;
  const followUp = followUpDisplayNote(result);
  function row(pill: BottlePill, grouped = false) {
    return <li id={`bottle-pill-${pill.number}`} key={pill.number} tabIndex={-1} className={cn("scroll-mt-28 p-5 outline-offset-4", !grouped && "rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)]", selected === pill.number && "outline-2 outline-ink")}>
      <div className="flex items-start gap-4">
        {photo ? <MiniCrop photo={photo} pill={pill} /> : <span aria-hidden className={cn("grid size-12 shrink-0 place-items-center rounded-full font-bold", TONE[state(pill)])}>{pill.number}</span>}
        <div className="min-w-0"><h3 className="text-xl font-bold">Pill {pill.number}</h3><p className="mt-1 text-lg font-semibold"><span aria-hidden>{SYMBOL[state(pill)]} </span>{word(pill)}{asks.has(pill.number) ? (red ? " · flip it to identify it" : " · flip this one") : ""}{pill.reread ? " · read again" : ""}</p><p className="mt-2 break-words font-mono text-lg">{pill.result.pill.imprintSides.join(" / ") || "No readable imprint"}</p><p className="mt-1 text-lg text-ink-soft">{[pill.result.pill.colors.join(" / "), pill.result.pill.shape].filter(Boolean).join(" · ")}</p></div>
      </div>
      {state(pill) === "looksLike" ? <p className="mt-4 text-lg">Its appearance matches the pills whose print we read. We haven&apos;t confirmed this pill&apos;s imprint.</p> : state(pill) === "matchedEarlier" ? <p className="mt-4 text-lg">We didn&apos;t read it again.</p>
        : pill.carried ? <p className="mt-4 text-lg">We couldn&apos;t confirm it in your first photo. We didn&apos;t read it again.</p>
        : pill.faceDown ? <p className="mt-4 text-lg">Flip it where it is so we can read the writing.</p>
        : mismatchLead(pill) ? <><p className="mt-4 text-lg font-semibold">{mismatchLead(pill)}</p>{pill.odd && <p className="mt-3 text-lg">It also has {pill.odd} from the others.</p>}</>
        : pill.odd ? <p className="mt-4 text-lg">{pill.result.verdict === "MATCH" || pill.result.verdict === "SAME_MEDICINE_DIFFERENT_MAKER" ? "Its imprint matches, but it has " : "It has "}{pill.odd} from the others. Check with your pharmacist.</p>
        : <p className="mt-4 text-lg">{pill.result.reasons[0]}</p>}
      {pill.shapeNote && <p className="mt-3 text-lg">Looked a little different in shape — probably the angle.</p>}
      {pill.appearanceWarning && <p className="mt-3 text-lg font-semibold">Looks different: {pill.appearanceWarning}. Check with your pharmacist.</p>}
      {pill.result.identifiedAs?.title && !mismatchLead(pill) && <p className="mt-3 text-lg font-semibold">FDA-listed imprint for {pill.result.identifiedAs.title}</p>}
      <details className="mt-4"><summary className="min-h-11 cursor-pointer py-2 text-lg font-semibold text-blue">FDA evidence and comparison</summary>
        <p className="mt-2 text-lg">{pill.result.reasons.join(" ")}</p>
        {pill.doubleRead && <p className="mt-3 text-lg">{pill.doubleRead.partial ? "Read twice, same fragment" : pill.doubleRead.agreed ? "Read twice, same result" : "The two reads did not agree"}. First: {pill.doubleRead.firstImprint.join(" / ")} ({pill.doubleRead.firstConfidence}); second: {pill.doubleRead.secondImprint.join(" / ")} ({pill.doubleRead.secondConfidence}).</p>}
        {pill.consensus && <p className="mt-3 text-lg">Appearance support from imprint-confirmed pills {pill.consensus.confirmedNumbers.join(", ")}. This is not an imprint confirmation.</p>}
        <dl className="mt-4 space-y-3 text-lg">{pill.result.features.map((f) => <div key={f.name}><dt className="font-semibold">{f.name}</dt><dd>FDA: {f.expected} · Read: {f.found} ({f.result.replaceAll("_", " ")})</dd></div>)}</dl>
        <ul className="mt-4 space-y-3">{pill.result.evidence.map((e) => <li key={e.url}><a className="break-words text-lg font-semibold text-blue" href={e.url} target="_blank" rel="noreferrer">{e.source}{e.setId ? ` label ${e.setId}` : ""} ↗</a>{e.setId && <p className="text-base text-ink-soft">Published {pill.result.labels[e.setId]?.publishedDate ?? "date unavailable"}</p>}</li>)}</ul>
        <p className="mt-3 text-base text-ink-soft">Checked {new Date(pill.result.checkedAt).toLocaleDateString("en-US", { timeZone: "UTC" })} · {pill.result.productsCompared} FDA products compared</p>
      </details>
    </li>;
  }
  return <div className="space-y-6">
    <section aria-labelledby="bottle-verdict" className={cn("rounded-[var(--radius-card)] p-6 shadow-[var(--shadow-soft)] sm:p-8", tone === "match" ? "verdict-match" : tone === "mismatch" ? "verdict-mismatch" : tone === "looksLike" ? "border-2 border-match/35 bg-[#f2fbf4]" : tone === "warning" ? "bg-[#fff3dc]" : tone === "calm" ? "bg-[#eef4fb]" : "bg-foil")}>
      <Icon aria-hidden className={cn("mb-4 size-9", tone === "match" ? "text-match" : tone === "mismatch" ? "text-mismatch" : "text-ink")} />
      {tone === "looksLike" && <p className="mb-2 text-lg font-bold text-match">Looks right</p>}
      <h2 id="bottle-verdict" className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{decision.title}</h2>
      <p className="mt-4 text-xl">{decision.instruction}</p>
      {followUp && <p className="mt-4 text-lg">{followUp}</p>}
      {nextLabel && onNext && <Button size="lg" className="mt-6 w-full text-lg sm:w-auto" variant={decision.verdict === "MISMATCH" ? "secondary" : "primary"} onClick={onNext}><RotateCcw aria-hidden />{nextLabel}</Button>}
      <p className="mt-5 text-lg text-ink-soft">This doesn&apos;t replace your pharmacist.</p>
    </section>
    <p aria-label="Bottle summary" className="text-base font-semibold sm:text-lg">{bottleSummary(result.pills)}{piled ? ` · ${piled} read in a pile` : ""}{clumps.length ? ` · ${clumps.length} circled, not read` : ""}</p>
    <section aria-label={photo ? "Your numbered pill photo" : "Pill positions from your photo"}>
      {photo ? <><h2 className="text-2xl font-bold">Is every pill numbered?</h2><p id="bottle-photo-help" className="mt-2 text-lg text-ink-soft">Check that every pill has a number. {asks.size ? (red ? "Flip the ringed pill only if you want to identify it. " : "Flip the ringed pills. ") : ""}{clumps.length ? "Circled areas weren't read. " : ""}Tap a number or a pill for its reading.</p></>
        : <p id="bottle-photo-help" className="text-lg text-ink-soft">Each dot is a pill, in the spot it was in your photo. We never save photos.</p>}
      <div ref={overlay} data-bottle-overlay className="relative mt-4 w-full overflow-hidden rounded-[var(--radius-photo)] bg-foil" style={{ aspectRatio: `${result.image.width} / ${result.image.height}` }} aria-describedby="bottle-photo-help">
        {photo && <img src={photo} alt="Your photo of the pills, with a number beside each pill we found" className="absolute inset-0 h-full w-full" />}
        {!photo && result.pills.map(p => <div key={`shape-${p.number}`} aria-hidden className={cn("pointer-events-none absolute rounded-full", red && markerState(p, red) !== "mismatch" ? "bg-ink/8" : "bg-ink/15")} style={box(p.box)} />)}
        {clumps.map((c, i) => <div key={`clump-${i}`} role="img" aria-label={c.kind === "touching" ? "Circled: pills touching, not read" : "Circled: pill cut off at the edge, not read"} className="pointer-events-none absolute rounded-full border-[3px] border-dashed border-amber shadow-[0_0_0_3px_#fff8]" style={box(c.box, 0.12)} />)}
        {result.pills.filter(p => asks.has(p.number)).map(p => <div key={`ring-${p.number}`} data-pill-ring={p.number} aria-hidden className="pointer-events-none absolute rounded-full shadow-[0_0_0_4px_var(--amber),0_0_0_7px_white]" style={box(p.box)} />)}
        {/* The pill itself is a tap target too; the pin beside it is the labelled button. */}
        {result.pills.map(p => <button key={`hit-${p.number}`} type="button" tabIndex={-1} aria-hidden onClick={() => selectPill(p.number)} className="absolute cursor-pointer rounded-full" style={box(p.box)} />)}
        {result.pills.map((pill, i) => {
          const m = markerState(pill, red), dim = m === "dim" || m === "dimMatch";
          const px = dim ? (m === "dim" ? 14 : 18) : pinPx;
          return <button key={pill.number} type="button" data-pill-number={pill.number} data-marker={m} onClick={() => selectPill(pill.number)} aria-label={`Pill ${pill.number}: ${word(pill)}${asks.has(pill.number) ? (red ? ", flip it to identify it" : ", flip this one") : ""}. See reading`}
            style={{ left: `${pins[i].x * 100}%`, top: `${pins[i].y * 100}%`, width: px, height: px }}
            className={cn("absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full leading-none", dim ? "shadow-[0_0_0_2px_#fff9]" : "shadow-[0_0_0_2px_white,0_2px_6px_#0004]", TONE[m], selected === pill.number && "outline-2 outline-offset-2 outline-ink")}>
            {m === "dim" ? null : m === "dimMatch" ? <span aria-hidden className="text-[11px] font-bold">✓</span>
              : <span className={cn("font-mono font-bold tracking-tighter", pinPx < 30 ? "text-[11px]" : "text-[13px]")}>{pill.number}<span aria-hidden>{MARKER_SYMBOL[m]}</span></span>}
          </button>;
        })}
      </div>
      <ul aria-label="Marker legend" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-lg text-ink-soft">
        {legend.map(l => <li key={l.key} className="flex items-center gap-2 whitespace-nowrap">
          {l.key === "notRead" ? <span aria-hidden className="inline-block size-4 rounded-full border-2 border-dashed border-amber" />
            : l.key === "dim" ? <span aria-hidden className="inline-block size-3 rounded-full bg-[#a3a8b0]" />
            : <span aria-hidden className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold", TONE[l.key])}>{l.symbol}</span>}
          {l.label}</li>)}
      </ul>
      {edgeNote && <p className="mt-3 text-lg">Something at the edge of the photo wasn&apos;t checked.</p>}
    </section>
    {red ? <>
      <section aria-labelledby="bottle-readings"><h2 id="bottle-readings" className="sr-only">The pill that doesn&apos;t match</h2><ol className="space-y-5">{wrong.map(p => row(p))}</ol></section>
      {otherPillsLine(result.pills) && <p className="text-lg font-semibold">{otherPillsLine(result.pills)}</p>}
      {others.length > 0 && <details data-pill-group="others" className="rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)]"><summary className="min-h-14 cursor-pointer p-5 text-lg font-semibold">See the other {others.length === 1 ? "pill" : `${others.length} pills`}</summary><ol>{others.map(p => row(p, true))}</ol></details>}
    </> : <>
    {attention.length > 0 && <section aria-labelledby="bottle-readings"><h2 id="bottle-readings" className="text-2xl font-bold">Pills that need attention</h2><ol className="mt-4 space-y-5">{attention.map(p => row(p))}</ol></section>}
    {matched.length > 0 && <details data-pill-group="matched" className="rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)]"><summary className="min-h-14 cursor-pointer p-5 text-lg font-semibold text-match">{matched.length} {attention.some(p => p.result.verdict === "MATCH" || p.result.verdict === "SAME_MEDICINE_DIFFERENT_MAKER") ? "other " : ""}{matched.length === 1 ? "pill matches" : "pills match"} your label</summary><ol>{matched.map(p => row(p, true))}</ol></details>}
    {lookalikes.length > 0 && <details data-pill-group="lookalikes" className="rounded-[var(--radius-card)] border-2 border-match/25 bg-white"><summary className="min-h-14 cursor-pointer p-5 text-lg font-semibold text-match">{lookalikes.length} pills look like the confirmed ones</summary><ol>{lookalikes.map(p => row(p, true))}</ol></details>}
    {earlier.length > 0 && <details data-pill-group="earlier" className="rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)]"><summary className="min-h-14 cursor-pointer p-5 text-lg font-semibold text-match">{earlier.length} {earlier.length === 1 ? "pill" : "pills"} matched in your first photo</summary><ol>{earlier.map(p => row(p, true))}</ol></details>}
    </>}
    <div className="flex flex-col gap-3 sm:flex-row">{onRetake && <Button variant="secondary" onClick={onRetake}>Start over with a new photo</Button>}{shareId && <ButtonLink href={`/result/${shareId}`} variant="secondary">Open shareable result</ButtonLink>}<ButtonLink href="/check#one" variant="ghost">Check one pill</ButtonLink></div>
  </div>;
}

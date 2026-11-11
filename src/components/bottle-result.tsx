"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, HelpCircle, X } from "lucide-react";
import { ButtonLink } from "@/components/button";
import { pixelCrop } from "@/lib/bottle/overlay";
import type { BottlePill, BottleResult } from "@/lib/bottle/types";
import { VERDICT_COPY } from "@/lib/verdict";
import { cn } from "@/lib/utils";

const pillTone = (p: BottlePill) => p.result.verdict === "MISMATCH" ? "bg-mismatch text-white" : p.result.verdict === "UNSURE" ? "bg-ink-soft text-white" : "bg-match text-white";
const pillSymbol = (p: BottlePill) => p.result.verdict === "MISMATCH" ? "×" : p.result.verdict === "UNSURE" ? "?" : "✓";
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
export function BottleResultView({ result, photo, shareId, onRetake }: { result: BottleResult; photo?: string; shareId?: string; onRetake?: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const { decision } = result;
  const tone = decision.verdict === "MATCH" ? "match" : decision.verdict === "MISMATCH" ? "mismatch" : decision.verdict === "WARNING" ? "warning" : "unsure";
  const Icon = tone === "match" ? Check : tone === "mismatch" ? X : tone === "warning" ? AlertTriangle : HelpCircle;
  function selectPill(number: number) {
    setSelected(number);
    const row = document.getElementById(`bottle-pill-${number}`);
    row?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    row?.focus({ preventScroll: true });
  }
  return <div className="space-y-8">
    <section aria-labelledby="bottle-verdict" className={cn("rounded-[var(--radius-card)] p-6 shadow-[var(--shadow-soft)] sm:p-8", tone === "match" ? "verdict-match" : tone === "mismatch" ? "verdict-mismatch" : tone === "warning" ? "bg-[#fff3dc]" : "bg-foil")}>
      <Icon aria-hidden className={cn("mb-4 size-9", tone === "match" ? "text-match" : tone === "mismatch" ? "text-mismatch" : "text-ink")} />
      <p className="mb-2 text-base font-semibold text-ink-soft">Whole-bottle photo · {result.pills.length} detected pills</p>
      <h2 id="bottle-verdict" className="text-2xl font-bold tracking-tight sm:text-3xl">{decision.title}</h2>
      <p className="mt-4 text-lg">{decision.instruction}</p>
      <p className="mt-4 text-base text-ink-soft">This does not replace your pharmacist. Unseen or undetected pills are not checked.</p>
    </section>
    <section aria-labelledby="bottle-photo-title">
      <h2 id="bottle-photo-title" className="text-2xl font-bold">Is every pill numbered?</h2>
      <p id="bottle-photo-help" className="mt-2 text-lg text-ink-soft">Check your photo carefully. If a pill has no number, retake it with more space and contrast. Tap a number to see its reading.</p>
      {!photo && <p className="mt-3 rounded-2xl bg-foil p-4 text-base">Photos are never saved. These numbers keep the original positions on a neutral background.</p>}
      <div className="relative mt-5 w-full overflow-hidden rounded-[var(--radius-photo)] bg-foil" style={{ aspectRatio: `${result.image.width} / ${result.image.height}` }} aria-describedby="bottle-photo-help">
        {photo && <img src={photo} alt="Your whole-bottle photograph with a numbered marker on each detected pill" className="absolute inset-0 h-full w-full" />}
        {result.pills.map((pill) => {
          const corner = { x: (pill.box.x + pill.box.width) * 100, y: pill.box.y * 100 };
          return <button key={pill.number} type="button" onClick={() => selectPill(pill.number)} aria-label={`Pill ${pill.number}: ${VERDICT_COPY[pill.result.verdict].word}. See reading`} style={{ left: `clamp(22px, ${corner.x}%, calc(100% - 22px))`, top: `clamp(22px, ${corner.y}%, calc(100% - 22px))` }} className={cn("absolute grid min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-[0_0_0_3px_white,0_2px_8px_#0004]", pillTone(pill))}><span className="font-mono text-base font-bold">{pill.number}<span className="ml-0.5 text-xs" aria-hidden>{pillSymbol(pill)}</span></span></button>;
        })}
      </div>
      <p className="mt-3 text-base text-ink-soft">✓ Matches / same medicine · × Doesn&apos;t match · ? Can&apos;t tell</p>
    </section>
    <section aria-labelledby="bottle-readings"><h2 id="bottle-readings" className="text-2xl font-bold">Every detected pill</h2>
      <ol className="mt-4 space-y-5">{result.pills.map((pill) => <li id={`bottle-pill-${pill.number}`} key={pill.number} tabIndex={-1} className={cn("scroll-mt-28 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-soft)] outline-offset-4", selected === pill.number && "outline-2 outline-ink")}>
        <div className="flex items-start gap-4">
          {photo ? <MiniCrop photo={photo} pill={pill} /> : <span aria-hidden className={cn("grid size-12 shrink-0 place-items-center rounded-full font-bold", pillTone(pill))}>{pill.number}</span>}
          <div className="min-w-0"><h3 className="text-xl font-bold">Pill {pill.number}</h3><p className="mt-1 font-semibold"><span aria-hidden>{pillSymbol(pill)} </span>{VERDICT_COPY[pill.result.verdict].word}</p><p className="mt-2 break-words font-mono text-lg">{pill.result.pill.imprintSides.join(" / ") || "No readable imprint"}</p><p className="mt-1 text-base text-ink-soft">{[pill.result.pill.colors.join(" / "), pill.result.pill.shape].filter(Boolean).join(" · ")}</p></div>
        </div>
        {pill.appearanceWarning && <p className="mt-4 rounded-2xl bg-[#fff3dc] p-4 font-semibold">Looks different: {pill.appearanceWarning}. Check with your pharmacist.</p>}
        <p className="mt-4 text-base">{pill.result.reasons.join(" ")}</p>
        {pill.result.identifiedAs?.title && <p className="mt-3 font-semibold">FDA-listed imprint for {pill.result.identifiedAs.title}</p>}
        <details className="mt-4"><summary className="min-h-11 cursor-pointer py-2 font-semibold text-blue">FDA evidence and comparison</summary>
          <dl className="mt-2 space-y-3 text-base">{pill.result.features.map((f) => <div key={f.name}><dt className="font-semibold">{f.name}</dt><dd>FDA: {f.expected} · Read: {f.found} ({f.result.replaceAll("_", " ")})</dd></div>)}</dl>
          <ul className="mt-4 space-y-3">{pill.result.evidence.map((e) => <li key={e.url}><a className="break-words text-base font-semibold text-blue" href={e.url} target="_blank" rel="noreferrer">{e.source}{e.setId ? ` label ${e.setId}` : ""} ↗</a>{e.setId && <p className="text-sm text-ink-soft">Published {pill.result.labels[e.setId]?.publishedDate ?? "date unavailable"}</p>}</li>)}</ul>
          <p className="mt-3 text-sm text-ink-soft">Checked {new Date(pill.result.checkedAt).toLocaleDateString("en-US", { timeZone: "UTC" })} · {pill.result.productsCompared} FDA products compared</p>
        </details>
      </li>)}</ol>
    </section>
    <div className="flex flex-col gap-3 sm:flex-row">{onRetake && <button type="button" onClick={onRetake} className="min-h-13 rounded-full bg-foil px-6 font-semibold">{decision.verdict === "UNSURE" ? "Flip unreadable pills and retake" : "Retake bottle photo"}</button>}{shareId && <ButtonLink href={`/result/${shareId}`} variant="secondary">Open shareable result</ButtonLink>}<ButtonLink href="/check" variant="ghost">Check one pill</ButtonLink></div>
  </div>;
}

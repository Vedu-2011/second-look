"use client";
// Phase 12: one bottle, up to three photos of different pills. One photo looks exactly like before. With more, one
// answer for the whole bottle comes first, then "Photo 1 · Photo 2" tabs; each photo keeps its own numbers.
import { useState } from "react";
import { AlertTriangle, Check, EqualApproximately, HelpCircle, RotateCcw, X } from "lucide-react";
import { BottleResultView } from "@/components/bottle-result";
import { combineBottle, MAX_PILL_PHOTOS } from "@/lib/bottle/combine";
import type { BottleResult } from "@/lib/bottle/types";
import { cn } from "@/lib/utils";

export type BottlePhotoEntry = { id?: string; result: BottleResult | null; photo?: string };
const SHORT: Record<BottleResult["decision"]["verdict"], string> = { MATCH: "All match", LOOKS_RIGHT: "Looks right", FACE_DOWN: "Flip some", UNSURE: "Not sure", WARNING: "Looks different", MISMATCH: "Doesn't match" };

export function BottleResults({ entries, shareId, onNext, onRetake, onMore }: { entries: BottlePhotoEntry[]; shareId?: string; onNext?: () => void; onRetake?: () => void; onMore?: () => void }) {
  const last = entries.length - 1;
  const [picked, setPicked] = useState<{ count: number; index: number }>({ count: entries.length, index: last });
  // A new photo always opens on itself.
  const selected = picked.count === entries.length ? Math.min(picked.index, last) : last;
  const known = entries.flatMap((e) => (e.result ? [e.result] : []));
  const combined = combineBottle(known);
  // Checking more pills makes no sense once a pill doesn't match: don't take any from this bottle.
  const more = onMore && entries.length < MAX_PILL_PHOTOS && combined.verdict !== "MISMATCH" ? onMore : undefined;
  const current = entries[selected];
  const view = (entry: BottlePhotoEntry, latest: boolean) => entry.result
    ? <BottleResultView key={entry.id ?? selected} result={entry.result} photo={entry.photo} shareId={latest ? shareId : undefined} onNext={latest ? onNext : undefined} onRetake={latest ? onRetake : undefined} onMore={latest ? more : undefined} />
    : <p className="rounded-[var(--radius-card)] bg-foil p-5 text-lg">This photo&apos;s result has expired. Results are kept for seven days.</p>;
  if (entries.length === 1) return view(entries[0], true);
  const tone = combined.verdict === "MATCH" ? "match" : combined.verdict === "MISMATCH" ? "mismatch" : combined.verdict === "LOOKS_RIGHT" ? "looksLike" : combined.verdict === "WARNING" ? "warning" : combined.verdict === "FACE_DOWN" ? "calm" : "unsure";
  const Icon = tone === "looksLike" ? EqualApproximately : tone === "match" ? Check : tone === "mismatch" ? X : tone === "warning" ? AlertTriangle : tone === "calm" ? RotateCcw : HelpCircle;
  return <div className="space-y-6">
    <section aria-labelledby="bottle-combined" className={cn("rounded-[var(--radius-card)] p-6 shadow-[var(--shadow-soft)] sm:p-8", tone === "match" ? "verdict-match" : tone === "mismatch" ? "verdict-mismatch" : tone === "looksLike" ? "border-2 border-match/35 bg-[#f2fbf4]" : tone === "warning" ? "bg-[#fff3dc]" : tone === "calm" ? "bg-[#eef4fb]" : "bg-foil")}>
      <p className="mb-2 text-lg font-semibold">Whole bottle · {entries.length} photos · {combined.pills} pills</p>
      <Icon aria-hidden className={cn("mb-4 size-9", tone === "match" ? "text-match" : tone === "mismatch" ? "text-mismatch" : "text-ink")} />
      <h2 id="bottle-combined" className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{combined.title}</h2>
      <p className="mt-4 text-xl">{combined.instruction}</p>
      {known.length < entries.length && <p className="mt-4 text-lg font-semibold">One photo&apos;s result has expired, so this isn&apos;t the whole bottle.</p>}
    </section>
    <div role="tablist" aria-label="Photos of pills" className="flex flex-wrap gap-2 rounded-[var(--radius-photo)] bg-foil p-1.5">
      {entries.map((e, i) => <button key={e.id ?? i} type="button" role="tab" id={`bottle-photo-tab-${i + 1}`} aria-selected={i === selected} aria-controls="bottle-photo-panel" onClick={() => setPicked({ count: entries.length, index: i })}
        className={cn("min-h-12 flex-1 rounded-[calc(var(--radius-photo)-6px)] px-4 py-2 text-left text-lg font-semibold", i === selected ? "bg-white shadow-[var(--shadow-soft)]" : "text-ink-soft")}>
        Photo {i + 1}<span className="block text-base font-normal">{e.result ? `${e.result.pills.length} pills · ${SHORT[e.result.decision.verdict]}` : "Expired"}</span>
      </button>)}
    </div>
    <div role="tabpanel" id="bottle-photo-panel" aria-labelledby={`bottle-photo-tab-${selected + 1}`} className="space-y-4">
      <h2 className="text-2xl font-bold">Photo {selected + 1}</h2>
      {view(current, selected === last)}
    </div>
  </div>;
}

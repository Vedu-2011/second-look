"use client";
/* eslint-disable @next/next/no-img-element */
import { Camera, ImageUp, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/button";
import { BottleResultView } from "@/components/bottle-result";
import { CheckingSteps, type StepState } from "@/components/checking-steps";
import type { BottleEvent, BottleResult } from "@/lib/bottle/types";
import { BOTTLE_BODY_BYTES, prepareBottlePhoto } from "@/lib/bottle/upload";

type Photo = Awaited<ReturnType<typeof prepareBottlePhoto>>;
type Phase = "label" | "bottle" | "again" | "checking" | "result" | "error";
const list = (n: readonly number[]) => n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n.at(-1)}` : String(n[0]);
/** What to do before the second photo, from the first result. */
function againSteps(result: BottleResult) {
  const asks = result.decision.asks ?? [], next = result.decision.next;
  if (next === "pour_again") return "Give the pills a gentle shake, pour them out again and spread them out. Then snap a new photo.";
  const flip = asks.length ? `Flip ${asks.length === 1 ? "pill" : "pills"} ${list(asks)} where ${asks.length === 1 ? "it is" : "they are"}.` : "";
  const nudge = next === "nudge" || next === "flip_and_nudge" ? "Nudge the circled pills apart." : "";
  return `${[flip, nudge].filter(Boolean).join(" ")} Leave the other pills where they are, and snap from about the same spot.`;
}
export function BottleFlow() {
  const [phase, setPhase] = useState<Phase>("label");
  const [label, setLabel] = useState<Photo>();
  const [bottle, setBottle] = useState<Photo>();
  const [again, setAgain] = useState<Photo>();
  const [result, setResult] = useState<BottleResult>();
  const [shareId, setShareId] = useState<string>();
  const [continuationToken, setContinuationToken] = useState<string>();
  const [error, setError] = useState("");
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [steps, setSteps] = useState<StepState[]>(["waiting", "waiting", "waiting", "waiting"]);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const heading = useRef<HTMLDivElement>(null), camera = useRef<HTMLInputElement>(null), upload = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]), controllerRef = useRef<AbortController | null>(null);
  useEffect(() => { heading.current?.focus(); }, [phase]);
  useEffect(() => () => { urls.current.forEach((url) => URL.revokeObjectURL(url)); controllerRef.current?.abort(); }, []);
  const kind = phase === "label" ? "label" : "bottle";
  const photo = phase === "label" ? label : phase === "again" ? again : bottle;
  async function choose(file?: File) {
    if (!file) return;
    setError(""); setBusyPhoto(true);
    try { const next = await prepareBottlePhoto(file, kind); urls.current.push(next.preview); if (phase === "label") setLabel(next); else if (phase === "again") setAgain(next); else setBottle(next); }
    catch (e) { setError(e instanceof Error ? e.message : "We couldn't prepare that photo."); }
    finally { setBusyPhoto(false); }
  }
  /** First check: label + pills. "Snap again": only the new pills photo plus the first check's saved id. */
  async function check(previousId?: string) {
    const pills = previousId ? again : bottle;
    if ((!previousId && !label) || !pills || controllerRef.current) return;
    setError(""); if (!previousId) { setResult(undefined); setShareId(undefined); setContinuationToken(undefined); } setPhase("checking");
    setSteps(["waiting", "waiting", "waiting", "waiting"]); setProgress({ completed: 0, total: 0 });
    const controller = new AbortController(); controllerRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 125_000);
    let terminal = false;
    function receive(event: BottleEvent) {
      if (event.type === "step") setSteps((s) => s.map((v, i) => i === event.step ? event.state : v));
      if (event.type === "progress") setProgress({ completed: event.completed, total: event.total });
      if (event.type === "segmented") setProgress({ completed: 0, total: event.boxes.length });
      if (event.type === "retake" || event.type === "error") { terminal = true; setError(event.message); setPhase("error"); }
      if (event.type === "result") { terminal = true; if (previousId) { setBottle(pills); setAgain(undefined); } setResult(event.result); setShareId(event.shareId); setContinuationToken(event.continuationToken); setPhase("result"); }
    }
    try {
      const form = new FormData(); form.set("bottleImage", pills!.blob, "pills.jpg");
      if (previousId) { form.set("previousId", previousId); form.set("continuationToken", continuationToken ?? ""); } else form.set("labelImage", label!.blob, "label.jpg");
      // Browser-generated multipart overhead is bounded before sending, under the platform's cap.
      if ((await new Response(form).blob()).size > BOTTLE_BODY_BYTES) throw new Error("Those photos are too large together. Please choose them again.");
      const response = await fetch("/api/check-bottle", { method: "POST", body: form, signal: controller.signal });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || "We couldn't start this check. Please try again with smaller photos."); }
      if (!response.body) throw new Error("The check didn't start. Please try again.");
      const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = "";
      while (true) { const part = await reader.read(); if (part.done) break; buffer += decoder.decode(part.value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() || ""; for (const line of lines) if (line.trim()) receive(JSON.parse(line)); }
      if (buffer.trim()) receive(JSON.parse(buffer));
      if (!terminal) throw new Error("The check ended early. Please try again.");
    } catch (e) { setError(controller.signal.aborted ? "That check took too long. Try fewer pills or check one pill." : e instanceof Error ? e.message : "We couldn't finish this check."); setPhase("error"); }
    finally { clearTimeout(timer); controllerRef.current = null; }
  }
  const title = phase === "label" ? "Photo of the label" : phase === "bottle" ? "Photo of all the pills" : phase === "again" ? "Snap the same pills again" : phase === "checking" ? "Checking the pills we find" : phase === "result" ? "Your whole-bottle photo check" : "Let's take another look";
  return <div className="space-y-6">
    <div ref={heading} tabIndex={-1} className="outline-none"><p className="mb-2 text-lg font-semibold text-ink-soft">Check my pills{["label", "bottle"].includes(phase) ? ` · Step ${phase === "label" ? 1 : 2} of 2` : ""}</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1></div>
    {(phase === "label" || phase === "bottle" || phase === "again") && <>
      {phase === "label" && <p className="text-xl text-ink-soft">Fit the whole pharmacy label in the frame. Flat, in good light.</p>}
      {phase === "bottle" && <><p className="text-xl font-semibold">Pour onto something dark, like a towel or plate. Spread them out.</p><p className="text-lg text-ink-soft">Keep every pill in the photo, up to 20. Letters up if you can, but don&apos;t worry: we&apos;ll tell you which ones to flip.</p></>}
      {phase === "again" && result && <><p className="text-xl font-semibold">{againSteps(result)}</p>{bottle && <AskedPills result={result} photo={bottle.preview} />}</>}
      <div className="grid min-h-60 place-items-center overflow-hidden rounded-[var(--radius-photo)] bg-foil p-4">{photo ? <img src={photo.preview} alt={phase === "label" ? "Your label photo" : "Your full-resolution whole-bottle photo"} className="max-h-96 w-full rounded-2xl object-contain" /> : <div className="p-7 text-center"><Camera aria-hidden className="mx-auto mb-4 size-10 text-ink-soft" /><p>{phase === "label" ? "Your label goes here" : "Spread out all the pills here"}</p></div>}</div>
      <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" hidden onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
      <div className="flex flex-col gap-3 sm:flex-row"><Button variant="ink" disabled={busyPhoto} onClick={() => camera.current?.click()}><Camera aria-hidden />{photo ? "Retake photo" : phase === "label" ? "Take label photo" : "Take pills photo"}</Button><Button variant="secondary" disabled={busyPhoto} onClick={() => upload.current?.click()}><ImageUp aria-hidden />Upload a photo</Button></div>
      {busyPhoto && <p role="status">Preparing your photo at full resolution…</p>}
      <div className="flex flex-col gap-3 sm:flex-row">{phase === "bottle" && <Button variant="ghost" onClick={() => setPhase("label")}>Back to label</Button>}{phase === "again" && <Button variant="ghost" onClick={() => setPhase("result")}>Back to my result</Button>}{photo && <Button disabled={busyPhoto} size="lg" className="text-lg" onClick={() => phase === "label" ? setPhase("bottle") : phase === "again" ? void check(shareId) : void check()}>{phase === "label" ? "Next: photo of the pills" : phase === "again" ? "Check again" : "Check my pills"}</Button>}</div>
      <p className="text-lg text-ink-soft">{phase === "again" ? "We read the requested pills first. Earlier readings stay marked as history. Before a new green result, we read every pill again. If the layout changed, we start a full check." : "Photos stay in this check only. Shared results keep readings and positions, never photos. Every five pills count as one check (minimum one)."}</p>
    </>}
    {phase === "checking" && <CheckingSteps states={steps} labels={["Reading your label", "Finding the pills", `Reading each pill (${progress.completed} of ${progress.total || "…"})`, "Checking with FDA records"]} className="rounded-[var(--radius-photo)] bg-foil p-3" />}
    {error && <div role="alert" className="rounded-[var(--radius-card)] bg-foil p-5"><p className="text-lg font-semibold">{error}</p>{phase === "error" && <div className="mt-4 flex flex-col gap-3"><Button variant="secondary" onClick={() => setPhase(again ? "again" : "bottle")}>Retake pills photo</Button><Button variant="ghost" onClick={() => setPhase("label")}>Retake label photo</Button></div>}</div>}
    {phase === "result" && result && <BottleResultView result={result} photo={bottle?.preview} shareId={shareId} onNext={result.decision.next && shareId && continuationToken ? () => { setAgain(undefined); setError(""); setPhase("again"); } : undefined} onRetake={() => { setResult(undefined); setBottle(undefined); setPhase("bottle"); }} />}
  </div>;
}

/** The first photo with the pills to flip ringed and the touching ones circled, so you know which to touch. */
function AskedPills({ result, photo }: { result: BottleResult; photo: string }) {
  const asks = new Set(result.decision.asks ?? []);
  return <div className="relative w-full overflow-hidden rounded-[var(--radius-photo)] bg-foil" style={{ aspectRatio: `${result.image.width} / ${result.image.height}` }}>
    <img src={photo} alt="Your first photo, with the pills to flip ringed" className="absolute inset-0 h-full w-full" />
    {(result.clumps ?? []).map((c, i) => <div key={i} aria-hidden className="absolute rounded-full border-[3px] border-dashed border-amber" style={{ left: `${(c.box.x - c.box.width * 0.12) * 100}%`, top: `${(c.box.y - c.box.height * 0.12) * 100}%`, width: `${c.box.width * 124}%`, height: `${c.box.height * 124}%` }} />)}
    {result.pills.filter((p) => asks.has(p.number)).map((p) => <div key={p.number} className="absolute grid place-items-center rounded-full shadow-[0_0_0_4px_var(--amber),0_0_0_7px_white]" style={{ left: `${p.box.x * 100}%`, top: `${p.box.y * 100}%`, width: `${p.box.width * 100}%`, height: `${p.box.height * 100}%` }}><span className="grid min-h-11 min-w-11 place-items-center rounded-full bg-amber font-mono text-lg font-bold text-ink"><RotateCcw aria-hidden className="mr-0.5 inline size-4" />{p.number}</span></div>)}
  </div>;
}

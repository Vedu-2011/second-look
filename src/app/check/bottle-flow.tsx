"use client";
/* eslint-disable @next/next/no-img-element */
import { Camera, ImageUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/button";
import { BottleResultView } from "@/components/bottle-result";
import { CheckingSteps, type StepState } from "@/components/checking-steps";
import type { BottleEvent, BottleResult } from "@/lib/bottle/types";
import { BOTTLE_BODY_BYTES, prepareBottlePhoto } from "@/lib/bottle/upload";

type Photo = Awaited<ReturnType<typeof prepareBottlePhoto>>;
type Phase = "label" | "bottle" | "checking" | "result" | "error";
export function BottleFlow() {
  const [phase, setPhase] = useState<Phase>("label");
  const [label, setLabel] = useState<Photo>();
  const [bottle, setBottle] = useState<Photo>();
  const [result, setResult] = useState<BottleResult>();
  const [shareId, setShareId] = useState<string>();
  const [error, setError] = useState("");
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [steps, setSteps] = useState<StepState[]>(["waiting", "waiting", "waiting", "waiting"]);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const heading = useRef<HTMLDivElement>(null), camera = useRef<HTMLInputElement>(null), upload = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]), controllerRef = useRef<AbortController | null>(null);
  useEffect(() => { heading.current?.focus(); }, [phase]);
  useEffect(() => () => { urls.current.forEach((url) => URL.revokeObjectURL(url)); controllerRef.current?.abort(); }, []);
  const kind = phase === "label" ? "label" : "bottle";
  const photo = kind === "label" ? label : bottle;
  async function choose(file?: File) {
    if (!file) return;
    setError(""); setBusyPhoto(true);
    try { const next = await prepareBottlePhoto(file, kind); urls.current.push(next.preview); if (kind === "label") setLabel(next); else setBottle(next); }
    catch (e) { setError(e instanceof Error ? e.message : "We couldn't prepare that photo."); }
    finally { setBusyPhoto(false); }
  }
  async function check() {
    if (!label || !bottle || controllerRef.current) return;
    setError(""); setResult(undefined); setShareId(undefined); setPhase("checking");
    setSteps(["waiting", "waiting", "waiting", "waiting"]); setProgress({ completed: 0, total: 0 });
    const controller = new AbortController(); controllerRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 125_000);
    let terminal = false;
    function receive(event: BottleEvent) {
      if (event.type === "step") setSteps((s) => s.map((v, i) => i === event.step ? event.state : v));
      if (event.type === "progress") setProgress({ completed: event.completed, total: event.total });
      if (event.type === "segmented") setProgress({ completed: 0, total: event.boxes.length });
      if (event.type === "retake" || event.type === "error") { terminal = true; setError(event.message); setPhase("error"); }
      if (event.type === "result") { terminal = true; setResult(event.result); setShareId(event.shareId); setPhase("result"); }
    }
    try {
      const form = new FormData(); form.set("labelImage", label.blob, "label.jpg"); form.set("bottleImage", bottle.blob, "pills.jpg");
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
  const title = phase === "label" ? "Photo of the label" : phase === "bottle" ? "Photo of all the pills" : phase === "checking" ? "Checking the pills we find" : phase === "result" ? "Your whole-bottle photo check" : "Let's take another look";
  return <div className="space-y-6">
    <div ref={heading} tabIndex={-1} className="outline-none"><p className="mb-2 text-base font-semibold text-ink-soft">Check the whole bottle{["label", "bottle"].includes(phase) ? ` · Step ${phase === "label" ? 1 : 2} of 2` : ""}</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1></div>
    {(phase === "label" || phase === "bottle") && <>
      <p className="text-lg text-ink-soft">{phase === "label" ? "Fit the whole pharmacy label in the frame. Flat, in good light." : "Pour the pills onto a plain surface that's a different color from the pills (a sheet of colored paper works well). Spread them out so they don't touch. Letters up if you can. Maximum 20 pills."}</p>
      {phase === "bottle" && <p className="text-base text-ink-soft">Keep every pill inside the frame. Choose a still photo under 12 MB and 32 megapixels. We compress it for upload while keeping its full dimensions.</p>}
      <div className="grid min-h-60 place-items-center overflow-hidden rounded-[var(--radius-photo)] bg-foil p-4">{photo ? <img src={photo.preview} alt={phase === "label" ? "Your label photo" : "Your full-resolution whole-bottle photo"} className="max-h-96 w-full rounded-2xl object-contain" /> : <div className="p-7 text-center"><Camera aria-hidden className="mx-auto mb-4 size-10 text-ink-soft" /><p>{phase === "label" ? "Your label goes here" : "Spread out all the pills here"}</p></div>}</div>
      <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" hidden onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
      <div className="flex flex-col gap-3 sm:flex-row"><Button variant="ink" disabled={busyPhoto} onClick={() => camera.current?.click()}><Camera aria-hidden />{photo ? "Retake photo" : phase === "label" ? "Take label photo" : "Take bottle photo"}</Button><Button variant="secondary" disabled={busyPhoto} onClick={() => upload.current?.click()}><ImageUp aria-hidden />Upload a photo</Button></div>
      {busyPhoto && <p role="status">Preparing your photo at full resolution…</p>}
      <div className="flex flex-col gap-3 sm:flex-row">{phase === "bottle" && <Button variant="ghost" onClick={() => setPhase("label")}>Back to label</Button>}{photo && <Button disabled={busyPhoto} size="lg" onClick={() => phase === "label" ? setPhase("bottle") : void check()}>{phase === "label" ? "Next: photo of all pills" : "Check the whole bottle"}</Button>}</div>
      <p className="text-base text-ink-soft">Photos stay in this check only. Shared results contain readings and positions, never photos. One bottle uses one check per five pills, rounded up (minimum one).</p>
    </>}
    {phase === "checking" && <CheckingSteps states={steps} labels={["Reading your label", "Finding the pills", `Reading each pill (${progress.completed} of ${progress.total || "…"})`, "Checking with FDA records"]} className="rounded-[var(--radius-photo)] bg-foil p-3" />}
    {error && <div role="alert" className="rounded-[var(--radius-card)] bg-foil p-5"><p className="text-lg font-semibold">{error}</p>{phase === "error" && <div className="mt-4 flex flex-col gap-3"><Button variant="secondary" onClick={() => setPhase("bottle")}>Retake bottle photo</Button><Button variant="ghost" onClick={() => setPhase("label")}>Retake label photo</Button></div>}</div>}
    {phase === "result" && result && <BottleResultView result={result} photo={bottle?.preview} shareId={shareId} onRetake={() => { setResult(undefined); setBottle(undefined); setPhase("bottle"); }} />}
  </div>;
}

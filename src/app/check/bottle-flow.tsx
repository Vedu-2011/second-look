"use client";
/* eslint-disable @next/next/no-img-element */
import { Camera, ImageUp, Plus, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/button";
import { BottleResults, type BottlePhotoEntry } from "@/components/bottle-results";
import { CheckingSteps, type StepState } from "@/components/checking-steps";
import type { BottleEvent, BottleResult } from "@/lib/bottle/types";
import { pillRingPosition } from "@/lib/bottle/overlay";
import { BOTTLE_BODY_BYTES, prepareBottlePhoto } from "@/lib/bottle/upload";
import { classifyFailure, RETRYING_MESSAGE, type CheckFailure } from "@/lib/bottle/retry";
import { fieldWord, labelSummary, MAX_LABEL_PHOTOS, type KeyField, type LabelChoices, type LabelConflict } from "@/lib/bottle/label-merge";
import type { LabelReading } from "@/lib/verdict-engine";

type Photo = Awaited<ReturnType<typeof prepareBottlePhoto>>;
type Phase = "label" | "bottle" | "again" | "checking" | "result" | "error" | "coaching";
/** What the server read from the label photos so far (it keeps the readings; we only hold the id and token). */
type LabelRead = { labelId: string; labelToken: string; photos: number; label: LabelReading; conflicts: LabelConflict[]; missing: KeyField[]; exit?: { code: string; message: string } };
/** "Check more pills from this bottle": the result we came from, so "Back" can return to it. */
type MoreOf = { id: string; token: string; result: BottleResult; photo?: Photo };
/** The server may take up to its 300 s limit; give it that before calling it a timeout. */
const CHECK_TIMEOUT_MS = 305_000;
/** A tiny note to our logs when a check fails before or outside the server: never photos or readings. */
function reportFailure(failure: CheckFailure, extra: { attempt: number; elapsedMs: number; bytes: number; followUp: boolean; thrown?: unknown }) {
  try {
    const { thrown, ...rest } = extra;
    const note = JSON.stringify({ ...rest, kind: failure.kind, why: failure.why, status: failure.status, name: thrown instanceof Error ? thrown.name : undefined, message: thrown instanceof Error ? thrown.message.slice(0, 160) : undefined, online: navigator.onLine });
    if (!navigator.sendBeacon?.("/api/client-error", new Blob([note], { type: "application/json" }))) void fetch("/api/client-error", { method: "POST", body: note, keepalive: true }).catch(() => {});
  } catch {}
}
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
  const [labels, setLabels] = useState<Photo[]>([]);
  const label = labels[0];
  const [labelRead, setLabelRead] = useState<LabelRead>();
  const [labelBusy, setLabelBusy] = useState(false);
  const [labelNote, setLabelNote] = useState("");
  const [choices, setChoices] = useState<LabelChoices>({});
  const [earlier, setEarlier] = useState<BottlePhotoEntry[]>([]);
  const [moreOf, setMoreOf] = useState<MoreOf>();
  const [bottle, setBottle] = useState<Photo>();
  const [again, setAgain] = useState<Photo>();
  const [result, setResult] = useState<BottleResult>();
  const [shareId, setShareId] = useState<string>();
  const [continuationToken, setContinuationToken] = useState<string>();
  const [error, setError] = useState("");
  const [coaching, setCoaching] = useState<string[]>([]);
  const [coachingPrevious, setCoachingPrevious] = useState<string>();
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [failure, setFailure] = useState<CheckFailure>();
  const [retrying, setRetrying] = useState(false);
  const [steps, setSteps] = useState<StepState[]>(["waiting", "waiting", "waiting", "waiting"]);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const heading = useRef<HTMLDivElement>(null), camera = useRef<HTMLInputElement>(null), upload = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]), controllerRef = useRef<AbortController | null>(null), running = useRef(false), adding = useRef(false), labelSeq = useRef(0);
  const lastCheck = useRef<{ previousId?: string; checkAnyway: boolean; checkId?: string }>({ checkAnyway: false });
  useEffect(() => { heading.current?.focus(); }, [phase]);
  useEffect(() => () => { urls.current.forEach((url) => URL.revokeObjectURL(url)); controllerRef.current?.abort(); }, []);
  const coachingPhoto = coachingPrevious ? again : bottle;
  const kind = phase === "label" ? "label" : "bottle";
  const photo = phase === "label" ? label : phase === "again" ? again : bottle;
  async function choose(file?: File) {
    if (!file) return;
    setError(""); setBusyPhoto(true);
    try {
      const next = await prepareBottlePhoto(file, kind); urls.current.push(next.preview);
      if (phase === "label") {
        // "Add another photo of the label" adds to what we read; any other photo starts the label again.
        const add = adding.current && labelRead && labels.length < MAX_LABEL_PHOTOS; adding.current = false;
        setLabels(add ? [...labels, next] : [next]);
        if (!add) { setLabelRead(undefined); setChoices({}); }
        void readLabelPhoto(next, add ? labelRead : undefined);
      } else if (phase === "again") setAgain(next); else setBottle(next);
    }
    catch (e) { setError(e instanceof Error ? e.message : "We couldn't prepare that photo."); }
    finally { setBusyPhoto(false); }
  }
  /**
   * Reads one label photo right away, so the person sees what we read before the pills. If that fails on our side, the
   * check still works exactly as before: the first label photo goes along with the pills and is read there.
   */
  async function readLabelPhoto(photo: Photo, session?: LabelRead) {
    const seq = ++labelSeq.current;
    setLabelBusy(true); setLabelNote("");
    const form = new FormData(); form.set("labelImage", photo.blob, "label.jpg");
    if (session) { form.set("labelId", session.labelId); form.set("labelToken", session.labelToken); }
    let body: Partial<LabelRead> & { error?: string } = {}, ok = false;
    try { const response = await fetch("/api/read-label", { method: "POST", body: form }); ok = response.ok; body = await response.json().catch(() => ({})); } catch {}
    if (seq !== labelSeq.current) return; // A newer photo replaced this one.
    setLabelBusy(false);
    if (ok && body.labelId) { setLabelRead({ ...(body as LabelRead), labelToken: body.labelToken ?? session?.labelToken ?? "" }); return; }
    if (session) { setLabels((l) => l.slice(0, -1)); setLabelNote(body.error ?? "We couldn't read that photo. Try adding it again."); return; }
    setLabelRead(undefined); setLabelNote(body.error ?? "We'll read your label together with the pills.");
  }
  /** A brand-new check: drop every photo and result from the last one, so nothing stale is sent with the new label. */
  function startOver() {
    labelSeq.current++;
    setError(""); setFailure(undefined); setLabels([]); setLabelRead(undefined); setLabelNote(""); setLabelBusy(false); setChoices({}); setBottle(undefined); setAgain(undefined); setResult(undefined);
    setEarlier([]); setMoreOf(undefined); setShareId(undefined); setContinuationToken(undefined); setCoaching([]); setCoachingPrevious(undefined); setPhase("label");
  }
  const unresolved = labelRead?.conflicts.filter((c) => choices[c.field] === undefined) ?? [];
  /** Use the label read before the pills, unless it couldn't be read there (then the photo goes with the pills). */
  const useLabelRead = Boolean(labelRead && !labelRead.exit && !unresolved.length);
  const labelReady = Boolean(label) && !labelBusy && !labelRead?.exit && !unresolved.length;
  const shownLabel: LabelReading | undefined = labelRead && { ...labelRead.label, ...Object.fromEntries(labelRead.conflicts.filter((c) => choices[c.field] !== undefined).map((c) => [c.field, c.options[choices[c.field]!].value])) };
  function checkMore() {
    if (!result || !shareId || !continuationToken) return;
    setMoreOf({ id: shareId, token: continuationToken, result, photo: bottle }); setBottle(undefined); setError(""); setPhase("bottle");
  }
  function backFromMore() {
    if (!moreOf) return;
    setResult(moreOf.result); setShareId(moreOf.id); setContinuationToken(moreOf.token); setBottle(moreOf.photo); setMoreOf(undefined); setError(""); setPhase("result");
  }
  /**
   * First check: label + pills. "Snap again": only the new pills photo plus the first check's saved id.
   * A failure on our side keeps both photos and retries the SAME photos once by itself (the server reuses readings and
   * the quota those photos already paid for). Only a photo problem sends you back to the camera.
   */
  async function check(previousId?: string, checkAnyway = false, retryOf?: string) {
    const pills = previousId ? again : bottle;
    if ((!previousId && !moreOf && !label) || !pills || running.current) return;
    // One id per check; only a retry of THIS check resends it, so the server can reuse what it already read and reserved.
    const checkId = retryOf ?? crypto.randomUUID().replace(/-/g, "");
    running.current = true; lastCheck.current = { previousId, checkAnyway, checkId };
    setCoaching([]); setError(""); setFailure(undefined); if (!previousId) { setResult(undefined); setShareId(undefined); setContinuationToken(undefined); } setPhase("checking");
    try {
      for (let attempt = 1; attempt <= 2; attempt++) {
        setRetrying(attempt > 1);
        const failed = await attemptCheck(pills, previousId, checkAnyway, checkId, attempt);
        if (!failed) return;
        if (failed.kind === "ours" && attempt === 1) { setRetrying(true); await new Promise((resolve) => setTimeout(resolve, 1500)); continue; }
        setFailure(failed); setError(failed.message); setPhase("error"); return;
      }
    } finally { running.current = false; setRetrying(false); }
  }
  /** One request. Returns why it failed, or nothing when a result or coaching arrived. */
  async function attemptCheck(pills: Photo, previousId: string | undefined, checkAnyway: boolean, checkId: string, attempt: number): Promise<CheckFailure | undefined> {
    setSteps(["waiting", "waiting", "waiting", "waiting"]); setProgress({ completed: 0, total: 0 });
    const controller = new AbortController(); controllerRef.current = controller;
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    const started = performance.now();
    let done = false, failed: CheckFailure | undefined, bytes = 0;
    function receive(event: BottleEvent) {
      if (event.type === "coaching") { done = true; setCoaching(event.tips); setCoachingPrevious(previousId); setPhase("coaching"); }
      if (event.type === "step") setSteps((s) => s.map((v, i) => i === event.step ? event.state : v));
      if (event.type === "progress") setProgress({ completed: event.completed, total: event.total });
      if (event.type === "segmented") setProgress({ completed: 0, total: event.boxes.length });
      if (event.type === "retake" || event.type === "error") { done = true; failed = classifyFailure({ why: "event", event }); }
      if (event.type === "result") { done = true; if (previousId) { setBottle(pills); setAgain(undefined); } else if (moreOf) { const from = moreOf; setEarlier((e) => [...e, { id: from.id, result: from.result, photo: from.photo?.preview }]); setMoreOf(undefined); } setResult(event.result); setShareId(event.shareId); setContinuationToken(event.continuationToken); setPhase("result"); }
    }
    let thrown: unknown;
    try {
      const form = new FormData(); if (checkAnyway) form.set("checkAnyway", "1"); form.set("checkId", checkId); form.set("bottleImage", pills.blob, "pills.jpg");
      if (previousId) { form.set("previousId", previousId); form.set("continuationToken", continuationToken ?? ""); }
      else if (moreOf) { form.set("morePillsOf", moreOf.id); form.set("continuationToken", moreOf.token); }
      else if (useLabelRead && labelRead) { form.set("labelId", labelRead.labelId); form.set("labelToken", labelRead.labelToken); form.set("labelChoices", JSON.stringify(choices)); }
      else form.set("labelImage", label!.blob, "label.jpg");
      // Browser-generated multipart overhead is bounded before sending, under the platform's cap.
      bytes = (await new Response(form).blob()).size;
      if (bytes > BOTTLE_BODY_BYTES) return classifyFailure({ why: "too-large", message: "Those photos are too large together. Please choose them again." });
      let response: Response;
      try { response = await fetch("/api/check-bottle", { method: "POST", body: form, signal: controller.signal }); }
      catch (e) { thrown = e; failed = classifyFailure({ why: controller.signal.aborted ? "timeout" : "network" }); return failed; }
      if (!response.ok) { const body = await response.json().catch(() => ({})); failed = classifyFailure({ why: "http", status: response.status, error: body.error }); return failed; }
      if (!response.body) { failed = classifyFailure({ why: "ended-early" }); return failed; }
      const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = "";
      try {
        while (true) { const part = await reader.read(); if (part.done) break; buffer += decoder.decode(part.value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() || ""; for (const line of lines) if (line.trim()) receive(JSON.parse(line)); }
        if (buffer.trim()) receive(JSON.parse(buffer));
      } catch (e) { thrown = e; if (!done) failed = classifyFailure({ why: controller.signal.aborted ? "timeout" : e instanceof SyntaxError ? "bad-stream" : "network" }); }
      if (!done && !failed) failed = classifyFailure({ why: "ended-early" });
      return failed;
    } finally {
      clearTimeout(timer); controllerRef.current = null;
      if (failed && failed.kind !== "photo") reportFailure(failed, { attempt, elapsedMs: performance.now() - started, bytes, followUp: Boolean(previousId), thrown });
    }
  }
  const morePhoto = moreOf ? earlier.length + 2 : 0;
  const title = phase === "label" ? "Photo of the label" : phase === "bottle" ? (moreOf ? "Photo of more pills" : "Photo of all the pills") : phase === "again" ? "Snap the same pills again" : phase === "coaching" ? "A clearer photo will help" : phase === "checking" ? "Checking the pills we find" : phase === "result" ? "Your whole-bottle photo check" : "Let's take another look";
  return <div className="space-y-6">
    <div ref={heading} tabIndex={-1} className="outline-none"><p className="mb-2 text-lg font-semibold text-ink-soft">Check my pills{moreOf && phase === "bottle" ? ` · Photo ${morePhoto} of pills` : ["label", "bottle"].includes(phase) ? ` · Step ${phase === "label" ? 1 : 2} of 2` : ""}</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1></div>
    {(phase === "label" || phase === "bottle" || phase === "again") && <>
      {phase === "label" && <p className="text-xl text-ink-soft">Fit the whole pharmacy label in the frame. Flat, in good light.</p>}
      {phase === "bottle" && moreOf && <><p className="text-xl font-semibold">Put the pills you already checked back in the bottle first.</p><p className="text-lg text-ink-soft">Then pour out more pills and spread them out, up to 20. We use the same label.</p></>}
      {phase === "bottle" && !moreOf && <><p className="text-xl font-semibold">Pour them out. Try not to stack pills on top of each other.</p><p className="text-lg text-ink-soft">Keep every pill in the photo, up to 20. Letters up if you can, but don&apos;t worry: we&apos;ll tell you which ones to flip.</p></>}
      {phase === "again" && result && <><p className="text-xl font-semibold">{againSteps(result)}</p>{bottle && <AskedPills result={result} photo={bottle.preview} />}</>}
      {phase === "label" && labels.length > 1 ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{labels.map((l, i) => <figure key={l.preview} className="overflow-hidden rounded-[var(--radius-photo)] bg-foil p-2"><img src={l.preview} alt={`Your label photo ${i + 1}`} className="max-h-56 w-full rounded-2xl object-contain" /><figcaption className="mt-1 text-center text-base text-ink-soft">Photo {i + 1}</figcaption></figure>)}</div>
      : <div className="grid min-h-60 place-items-center overflow-hidden rounded-[var(--radius-photo)] bg-foil p-4">{photo ? <img src={photo.preview} alt={phase === "label" ? "Your label photo" : "Your full-resolution whole-bottle photo"} className="max-h-96 w-full rounded-2xl object-contain" /> : <div className="p-7 text-center"><Camera aria-hidden className="mx-auto mb-4 size-10 text-ink-soft" /><p>{phase === "label" ? "Your label goes here" : "Spread out all the pills here"}</p></div>}</div>}
      <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" hidden onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
      <div className="flex flex-col gap-3 sm:flex-row"><Button variant="ink" disabled={busyPhoto} onClick={() => { adding.current = false; camera.current?.click(); }}><Camera aria-hidden />{photo ? (phase === "label" && labels.length > 1 ? "Retake label photos" : "Retake photo") : phase === "label" ? "Take label photo" : "Take pills photo"}</Button><Button variant="secondary" disabled={busyPhoto} onClick={() => { adding.current = false; upload.current?.click(); }}><ImageUp aria-hidden />Upload a photo</Button></div>
      {busyPhoto && <p role="status">Preparing your photo at full resolution…</p>}
      {phase === "label" && label && <LabelReadCard read={labelRead} shown={shownLabel} busy={labelBusy} note={labelNote} choices={choices} onChoose={(field, i) => setChoices((c) => ({ ...c, [field]: i }))}
        onAdd={labelRead && !labelBusy && labels.length < MAX_LABEL_PHOTOS ? () => { adding.current = true; camera.current?.click(); } : undefined} onUpload={() => { adding.current = true; upload.current?.click(); }} />}
      <div className="flex flex-col gap-3 sm:flex-row">{phase === "bottle" && (moreOf ? <Button variant="ghost" onClick={backFromMore}>Back to my result</Button> : <Button variant="ghost" onClick={() => setPhase("label")}>Back to label</Button>)}{phase === "again" && <Button variant="ghost" onClick={() => setPhase("result")}>Back to my result</Button>}{photo && <Button disabled={busyPhoto || (phase === "label" && !labelReady)} size="lg" className="text-lg" onClick={() => phase === "label" ? setPhase("bottle") : phase === "again" ? void check(shareId) : void check()}>{phase === "label" ? "Next: photo of the pills" : phase === "again" ? "Check again" : "Check my pills"}</Button>}</div>
      <p className="text-lg text-ink-soft">{phase === "again" ? "We read the requested pills first. Earlier readings stay marked as history. Before a new green result, we read every pill again. If the layout changed, we start a full check." : "Photos stay in this check only. Shared results keep readings and positions, never photos. Every five pills count as one check (minimum one)."}</p>
    </>}
    {phase === "coaching" && <section className="space-y-5 rounded-[var(--radius-card)] bg-foil p-5 sm:p-7" aria-label="Photo tips before reading">
      <ul className="space-y-3 text-xl font-semibold">{coaching.map(tip => <li key={tip}>{tip}</li>)}</ul>
      {coachingPhoto && <img src={coachingPhoto.preview} alt="Your photo before any AI reading" className="max-h-80 w-full rounded-2xl object-contain" />}
      <p className="text-lg text-ink-soft">No AI reading has started. A clearer photo gives us a better chance of reading every pill.</p>
      <div className="flex flex-col gap-3 sm:flex-row"><Button size="lg" onClick={() => setPhase(coachingPrevious ? "again" : "bottle")}>Retake</Button><Button size="lg" variant="secondary" onClick={() => void check(coachingPrevious, true)}>Check anyway</Button></div>
    </section>}
    {phase === "checking" && retrying && <p role="status" className="text-lg font-semibold">{RETRYING_MESSAGE}</p>}
    {phase === "checking" && <CheckingSteps states={steps} labels={["Reading your label", "Finding the pills", `Reading each pill (${progress.completed} of ${progress.total || "…"})`, "Checking with FDA records"]} className="rounded-[var(--radius-photo)] bg-foil p-3" />}
    {error && <div role="alert" className="rounded-[var(--radius-card)] bg-foil p-5"><p className="text-lg font-semibold">{error}</p>{phase === "error" && (failure?.kind === "ours" || failure?.kind === "blocked"
      // Our side (or a limit): the photos are fine, so offer the SAME photos again, not the camera.
      ? <div className="mt-4 flex flex-col gap-3 sm:flex-row"><Button onClick={() => void check(lastCheck.current.previousId, lastCheck.current.checkAnyway, lastCheck.current.checkId)}>Try again</Button>{failure.kind === "blocked" && <Button variant="ghost" onClick={startOver}>Start a new check</Button>}</div>
      : <div className="mt-4 flex flex-col gap-3"><Button variant="secondary" onClick={() => setPhase(again ? "again" : "bottle")}>Retake pills photo</Button>{!moreOf && <Button variant="ghost" onClick={() => setPhase("label")}>Retake label photo</Button>}</div>)}</div>}
    {phase === "result" && result && <BottleResults entries={[...earlier, { id: shareId, result, photo: bottle?.preview }]} shareId={shareId} onNext={result.decision.next && shareId && continuationToken ? () => { setAgain(undefined); setError(""); setPhase("again"); } : undefined}
      onRetake={() => { setResult(undefined); setBottle(undefined); setEarlier([]); setPhase("bottle"); }} onMore={shareId && continuationToken ? checkMore : undefined} />}
  </div>;
}

/** The first photo with the pills to flip ringed and the touching ones circled, so you know which to touch. */
function AskedPills({ result, photo }: { result: BottleResult; photo: string }) {
  const asks = new Set(result.decision.asks ?? []);
  return <div className="relative w-full overflow-hidden rounded-[var(--radius-photo)] bg-foil" style={{ aspectRatio: `${result.image.width} / ${result.image.height}` }}>
    <img src={photo} alt="Your first photo, with the pills to flip ringed" className="absolute inset-0 h-full w-full" />
    {(result.clumps ?? []).filter(c => !c.readAsOne).map((c, i) => <div key={i} aria-hidden className="absolute rounded-full border-[3px] border-dashed border-amber" style={{ left: `${(c.box.x - c.box.width * 0.12) * 100}%`, top: `${(c.box.y - c.box.height * 0.12) * 100}%`, width: `${c.box.width * 124}%`, height: `${c.box.height * 124}%` }} />)}
    {result.pills.filter((p) => asks.has(p.number)).map((p) => <div key={p.number} className="absolute grid place-items-center rounded-full shadow-[0_0_0_4px_var(--amber),0_0_0_7px_white]" style={pillRingPosition(p.box, true)}><span className="grid min-h-11 min-w-11 place-items-center rounded-full bg-amber font-mono text-lg font-bold text-ink"><RotateCcw aria-hidden className="mr-0.5 inline size-4" />{p.number}</span></div>)}
  </div>;
}

/** What we read from the label photos, before the pills: the reading, what's missing, and any disagreement to settle. */
function LabelReadCard({ read, shown, busy, note, choices, onChoose, onAdd, onUpload }: { read?: LabelRead; shown?: LabelReading; busy: boolean; note: string; choices: LabelChoices; onChoose: (field: KeyField, option: number) => void; onAdd?: () => void; onUpload: () => void }) {
  if (busy) return <p role="status" className="rounded-[var(--radius-card)] bg-white p-5 text-lg font-semibold shadow-[var(--shadow-soft)]">Reading your label…</p>;
  if (!read) return note ? <p role="status" className="rounded-[var(--radius-card)] bg-foil p-5 text-lg">{note}</p> : null;
  const summary = shown ? labelSummary(shown) : "";
  return <section aria-label="What we read from your label" className="space-y-4 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-soft)]">
    {summary && <p className="text-xl"><span className="font-semibold">We read:</span> {summary}</p>}
    {read.photos > 1 && <p className="text-lg text-ink-soft">From {read.photos} photos of the label.</p>}
    {note && <p role="alert" className="text-lg font-semibold">{note}</p>}
    {read.exit ? <p role="alert" className="text-lg font-semibold">{read.exit.message}</p>
      : read.missing.length > 0 && read.photos < MAX_LABEL_PHOTOS && <p className="text-lg font-semibold">We couldn&apos;t read the whole label — turn the bottle and take another photo.</p>}
    {read.conflicts.map((c) => <fieldset key={c.field} className="space-y-3">
      <legend className="text-lg font-semibold">Your photos disagree on the {fieldWord(c.field)}. Which one is on your label?</legend>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{c.options.map((o, i) => <Button key={o.value} variant={choices[c.field] === i ? "ink" : "secondary"} aria-pressed={choices[c.field] === i} onClick={() => onChoose(c.field, i)}>{o.value} · photo {o.photos.map((p) => p + 1).join(" and ")}</Button>)}</div>
      <p className="text-base text-ink-soft">Not sure? Retake the label photos.</p>
    </fieldset>)}
    {onAdd && <div className="flex flex-col gap-3 sm:flex-row"><Button variant="secondary" onClick={onAdd}><Plus aria-hidden />Add another photo of the label</Button><Button variant="ghost" onClick={onUpload}><ImageUp aria-hidden />Upload another</Button></div>}
    {onAdd && <p className="text-base text-ink-soft">For labels that wrap around the bottle. Up to {MAX_LABEL_PHOTOS} photos; each extra one counts as one check.</p>}
  </section>;
}

"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/button";
import { CheckingSteps, type StepState } from "@/components/checking-steps";
import { ResultView } from "@/components/result-view";
import type { CheckResult } from "@/lib/check-service";
import type { Explanation } from "@/lib/ai/guard";
import type { CheckEvent } from "@/lib/check-input";

export function SampleCheck({ saved, explanation, photos, autoRun = false }: { saved: CheckResult; explanation: Explanation; photos: { label: string; pill: string } | null; autoRun?: boolean }) {
  const [result, setResult] = useState(saved);
  const [words, setWords] = useState(explanation);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("");
  const [steps, setSteps] = useState<StepState[]>(["waiting", "waiting", "waiting", "waiting"]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (autoRun) { const timer = setTimeout(() => buttonRef.current?.click(), 0); return () => clearTimeout(timer); } }, [autoRun]);
  async function run() {
    if (!photos) { setNotice("This bottle uses a saved FDA example. Add its two demo photos to run the photo check live. The saved check is shown below."); return; }
    setRunning(true); setNotice(""); setSteps(["waiting", "waiting", "waiting", "waiting"]);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const dataUrl = async (url: string) => {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("Sample photo unavailable");
        const blob = await response.blob();
        return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
      };
      const [label, pill] = await Promise.all([dataUrl(photos.label), dataUrl(photos.pill)]);
      const response = await fetch("/api/check", { method: "POST", signal: controller.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ labelImage: { dataUrl: label }, pillImage: { dataUrl: pill } }) });
      if (!response.ok || !response.body) throw new Error("Live check unavailable");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = ""; let finished = false;
      const receive = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as CheckEvent;
        if (event.type === "step") setSteps(old => old.map((state, i) => i === event.step ? event.state : state));
        if (event.type === "error" || event.type === "early_exit") throw new Error(event.message);
        if (event.type === "result") { finished = true; setResult(event.result as CheckResult); setWords(event.explanation as Explanation); setNotice("This result was checked live just now."); }
      };
      while (true) { const chunk = await reader.read(); pending += decoder.decode(chunk.value, { stream: !chunk.done }); const lines = pending.split("\n"); pending = lines.pop() ?? ""; lines.forEach(receive); if (chunk.done) break; }
      receive(pending);
      if (!finished) throw new Error("Check ended early");
    } catch {
      setResult(saved); setWords(explanation); setNotice("The live check is unavailable right now. Here is the saved check for this bottle, with its original date and FDA records.");
    } finally { clearTimeout(timer); setRunning(false); }
  }
  return <div className="mt-7 space-y-6">
    {photos && <div className="grid grid-cols-2 gap-4">{(["label", "pill"] as const).map(kind => <figure key={kind}><img src={photos[kind]} alt={`Demo ${kind} photo`} className="aspect-[4/3] w-full rounded-[var(--radius-photo)] bg-foil object-contain" /><figcaption className="mt-2 text-base text-ink-soft">{kind === "label" ? "Made-up pharmacy label" : "Real pill photo"}</figcaption></figure>)}</div>}
    <Button ref={buttonRef} size="lg" onClick={() => void run()} disabled={running} className="w-full sm:w-auto">{running ? "Checking this bottle…" : "Run this check live"}</Button>
    {notice && <p role="status" className="rounded-[var(--radius-row)] bg-foil p-4 text-base">{notice}</p>}
    {running ? <CheckingSteps states={steps} className="rounded-[var(--radius-photo)] bg-foil p-3" /> : <ResultView result={result} photo={photos?.pill} explanation={words} />}
  </div>;
}

"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/button";
import { ResultView } from "@/components/result-view";
import { COLOR_CODES, SHAPE_CODES } from "@/lib/fda/codes";
import type { CheckResult } from "@/lib/check-service";
import { EMPTY_TYPED, typedRequest, type TypedFields } from "@/lib/typed-check";
import { cn } from "@/lib/utils";

const input = "min-h-14 w-full rounded-[var(--radius-row)] bg-white px-4 text-lg shadow-[var(--shadow-soft)]";
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) { return <label className="flex flex-col gap-2"><span className="text-base font-semibold">{label}</span>{children}{hint && <span className="text-sm text-ink-soft">{hint}</span>}</label>; }
function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" aria-pressed={selected} onClick={onClick} className={cn("flex min-h-12 items-center gap-2 rounded-full px-4 text-base font-semibold transition-colors", selected ? "bg-ink text-label" : "bg-white text-ink shadow-[var(--shadow-soft)] hover:bg-foil-deep")}>{children}</button>; }

export function TypeForm() {
  const [fields, setFields] = useState<TypedFields>(EMPTY_TYPED);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const set = <K extends keyof TypedFields>(key: K, value: TypedFields[K]) => setFields(f => ({ ...f, [key]: value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(typedRequest(fields)) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "We couldn't finish the check. Try again.");
      setResult(body);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (error) { setError(error instanceof Error ? error.message : "Check your connection and try again."); }
    finally { setLoading(false); }
  }
  return <div className="space-y-10"><form onSubmit={submit} className="space-y-8" aria-busy={loading}>
    <fieldset disabled={loading} className="rounded-[var(--radius-photo)] bg-foil p-5 sm:p-7"><legend className="sr-only">Your bottle label</legend><h2 className="text-2xl font-bold">1. Your bottle label</h2>
      <div className="mt-5 flex flex-wrap gap-2"><Chip selected={fields.mode === "ndc"} onClick={() => set("mode", "ndc")}>Use the NDC</Chip><Chip selected={fields.mode === "name"} onClick={() => set("mode", "name")}>Use medicine name</Chip></div>
      <div className="mt-5">{fields.mode === "ndc" ? <Field label="NDC on the label" hint="The medicine's code, often near the bottom. Keep the dashes if printed."><input className={cn(input,"font-mono")} required value={fields.ndc} onChange={e => set("ndc", e.target.value)} placeholder="e.g. 0113-0517" maxLength={20} /></Field> : <div className="grid gap-4 sm:grid-cols-2"><Field label="Medicine name"><input className={input} required value={fields.drugName} onChange={e => set("drugName", e.target.value)} placeholder="e.g. Ibuprofen" maxLength={120} /></Field><Field label="Strength"><input className={cn(input,"font-mono")} required value={fields.strength} onChange={e => set("strength", e.target.value)} placeholder="e.g. 200 mg" maxLength={40} /></Field></div>}</div>
      <div className="mt-5"><Field label="Form on the label"><select className={input} value={fields.form} onChange={e => set("form", e.target.value)}><option value="tablet">Tablet</option><option value="capsule">Capsule</option></select></Field></div>
    </fieldset>
    <fieldset disabled={loading} className="rounded-[var(--radius-photo)] bg-foil p-5 sm:p-7"><legend className="sr-only">Your pill</legend><h2 className="text-2xl font-bold">2. Your pill</h2><p className="mt-2 text-base text-ink-soft">Look at one pill in good light. Turn it over to check both sides.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Imprint on one side" hint="Letters and numbers stamped on the pill."><input className={cn(input,"font-mono")} value={fields.side1} onChange={e => set("side1", e.target.value)} placeholder="e.g. I2 or L484" maxLength={40} /></Field><Field label="Other side (optional)"><input className={cn(input,"font-mono")} value={fields.side2} onChange={e => set("side2", e.target.value)} placeholder="Leave blank if none" maxLength={40} /></Field></div>
      <label className="mt-4 flex min-h-12 items-center gap-3 text-base"><input type="checkbox" className="size-5 accent-ink" checked={fields.uncertain} onChange={e => set("uncertain", e.target.checked)} />I&apos;m not sure I can read the letters</label>
      <fieldset className="mt-5"><legend className="mb-3 text-base font-semibold">Color (choose both if two-tone)</legend><div className="flex flex-wrap gap-2">{Object.values(COLOR_CODES).map(c => <Chip key={c.color} selected={fields.colors.includes(c.color)} onClick={() => set("colors", fields.colors.includes(c.color) ? fields.colors.filter(v => v !== c.color) : [...fields.colors, c.color].slice(-2))}><span className="size-4 rounded-full ring-1 ring-current/20" style={{ backgroundColor: c.hex }} aria-hidden />{c.name}</Chip>)}</div></fieldset>
      <fieldset className="mt-6"><legend className="mb-3 text-base font-semibold">Shape</legend><div className="flex flex-wrap gap-2">{["round", "oval", "capsule", "rectangle", "square", "triangle", "diamond"].map(shape => <Chip key={shape} selected={fields.shape === shape} onClick={() => set("shape", fields.shape === shape ? "" : shape)}>{shape[0].toUpperCase() + shape.slice(1)}</Chip>)}</div><details className="mt-3"><summary className="min-h-12 cursor-pointer py-2 text-base font-semibold">Other shapes</summary><div className="mt-2 flex flex-wrap gap-2">{Object.values(SHAPE_CODES).filter(s => !["round", "oval", "capsule", "rectangle", "square", "triangle", "diamond"].includes(s.shape)).map(s => <Chip key={s.shape} selected={fields.shape === s.shape} onClick={() => set("shape", s.shape)}>{s.name}</Chip>)}</div></details></fieldset>
    </fieldset>
    {error && <p role="alert" className="rounded-[var(--radius-row)] bg-foil p-4 font-semibold">{error}</p>}
    <Button type="submit" size="lg" disabled={loading}>{loading ? "Checking FDA records…" : "Check my pill"}</Button>
  </form>{result && <div ref={resultRef} tabIndex={-1} className="outline-none"><h2 className="mb-5 text-2xl font-bold">Here is your result</h2><ResultView result={result} /></div>}</div>;
}

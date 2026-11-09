"use client";

import { useState } from "react";
import { Button } from "@/components/button";
import { ResultView } from "@/components/result-view";
import type { CheckResult } from "@/lib/check-service";
import { SCENARIOS, type Scenario } from "@/lib/demo-scenarios";
import { cn } from "@/lib/utils";

type Form = {
  ndc: string;
  drugName: string;
  strength: string;
  side1: string;
  side2: string;
  imprintConfidence: string;
  colors: string;
  colorConfidence: string;
  shape: string;
  shapeConfidence: string;
  guessDrug: string;
  guessStrength: string;
};

const EMPTY: Form = {
  ndc: "",
  drugName: "",
  strength: "",
  side1: "",
  side2: "",
  imprintConfidence: "0.95",
  colors: "",
  colorConfidence: "0.9",
  shape: "round",
  shapeConfidence: "0.9",
  guessDrug: "",
  guessStrength: "",
};

const SHAPES = ["round", "oval", "capsule", "oblong", "rectangle", "square", "diamond", "triangle", "pentagon", "hexagon", "octagon", "tear", "freeform"];

function fromScenario(s: Scenario): Form {
  return {
    ndc: s.label.ndc ?? "",
    drugName: s.label.ndc ? "" : (s.label.drugName ?? ""),
    strength: s.label.ndc ? "" : (s.label.strength ?? ""),
    side1: s.pill.imprintSides[0] ?? "",
    side2: s.pill.imprintSides[1] ?? "",
    imprintConfidence: String(s.pill.imprintConfidence),
    colors: s.pill.colors.join(", "),
    colorConfidence: String(s.pill.colorConfidence),
    shape: s.pill.shape,
    shapeConfidence: String(s.pill.shapeConfidence),
    guessDrug: s.pill.guess?.drugName ?? "",
    guessStrength: s.pill.guess?.strength ?? "",
  };
}

function toRequest(f: Form) {
  const num = (s: string) => Math.min(1, Math.max(0, Number(s) || 0));
  return {
    label: {
      ndc: f.ndc.trim() || undefined,
      drugName: f.drugName.trim() || undefined,
      strength: f.strength.trim() || undefined,
      form: "tablet",
    },
    pill: {
      imprintSides: [f.side1, f.side2].map((s) => s.trim()).filter(Boolean),
      imprintConfidence: num(f.imprintConfidence),
      colors: f.colors.split(/[,/]| and /).map((s) => s.trim()).filter(Boolean),
      colorConfidence: num(f.colorConfidence),
      shape: f.shape,
      shapeConfidence: num(f.shapeConfidence),
      form: "tablet",
      guess: f.guessDrug.trim() ? { drugName: f.guessDrug.trim(), strength: f.guessStrength.trim() || undefined } : null,
    },
  };
}

const input =
  "min-h-12 w-full rounded-[var(--radius-row)] bg-white px-4 text-lg text-ink shadow-[var(--shadow-soft)] placeholder:text-ink-soft/70";

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-base font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="text-sm text-ink-soft">{hint}</span>}
    </label>
  );
}

/** Starts a clock; call the returned function for elapsed ms. Lives outside the component (render purity). */
function startTimer() {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}

export function DevCheckForm() {
  const [form, setForm] = useState<Form>(fromScenario(SCENARIOS[0]));
  const [active, setActive] = useState<string | null>(SCENARIOS[0].id);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ms, setMs] = useState<number | null>(null);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setActive(null);
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  async function submit(f: Form = form) {
    setLoading(true);
    setError(null);
    const started = startTimer();
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(toRequest(f)),
      });
      const json = await res.json();
      if (!res.ok) {
        setResult(null);
        setError(json.error ?? "Something went wrong. Please try again.");
      } else {
        setResult(json);
        requestAnimationFrame(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setMs(started());
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <p className="text-base font-semibold text-ink-soft">Demo bottles</p>
        <div className="flex flex-wrap gap-2">
          {SCENARIOS.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant={active === s.id ? "ink" : "secondary"}
              onClick={() => {
                const f = fromScenario(s);
                setForm(f);
                setActive(s.id);
                void submit(f);
              }}
            >
              {s.title}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setForm(EMPTY);
              setActive(null);
              setResult(null);
              setError(null);
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      <form
        className="flex flex-col gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-2xl font-bold text-ink">What the label says</legend>
          <Field label="NDC" hint="From the label, any format. Leave empty to use the name instead.">
            <input className={cn(input, "font-mono")} value={form.ndc} onChange={set("ndc")} placeholder="0113-0517-78" inputMode="numeric" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Medicine name">
              <input className={input} value={form.drugName} onChange={set("drugName")} placeholder="Ibuprofen" />
            </Field>
            <Field label="Strength">
              <input className={cn(input, "font-mono")} value={form.strength} onChange={set("strength")} placeholder="200 mg" />
            </Field>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-2xl font-bold text-ink">What&apos;s on the pill</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Imprint, side 1">
              <input className={cn(input, "font-mono")} value={form.side1} onChange={set("side1")} placeholder="I2" />
            </Field>
            <Field label="Imprint, side 2" hint="If you can see it">
              <input className={cn(input, "font-mono")} value={form.side2} onChange={set("side2")} />
            </Field>
            <Field label="Imprint confidence" hint="0 to 1. Under 0.7 means unsure.">
              <input className={cn(input, "font-mono")} type="number" min={0} max={1} step={0.05} value={form.imprintConfidence} onChange={set("imprintConfidence")} />
            </Field>
            <Field label="Colors" hint="Comma between two-tone colors">
              <input className={input} value={form.colors} onChange={set("colors")} placeholder="orange" />
            </Field>
            <Field label="Shape">
              <select className={input} value={form.shape} onChange={set("shape")}>
                {SHAPES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Color conf.">
                <input className={cn(input, "font-mono")} type="number" min={0} max={1} step={0.05} value={form.colorConfidence} onChange={set("colorConfidence")} />
              </Field>
              <Field label="Shape conf.">
                <input className={cn(input, "font-mono")} type="number" min={0} max={1} step={0.05} value={form.shapeConfidence} onChange={set("shapeConfidence")} />
              </Field>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Guess: what it might be" hint="Only a lead. We check it against FDA data.">
              <input className={input} value={form.guessDrug} onChange={set("guessDrug")} placeholder="acetaminophen" />
            </Field>
            <Field label="Guess strength">
              <input className={cn(input, "font-mono")} value={form.guessStrength} onChange={set("guessStrength")} placeholder="500 mg" />
            </Field>
          </div>
        </fieldset>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" size="lg" disabled={loading}>
            {loading ? "Checking FDA records…" : "Check against FDA records"}
          </Button>
          {ms !== null && !loading && <p className="text-base text-ink-soft">Answered in {ms} ms</p>}
        </div>
      </form>

      {error && (
        <p role="alert" className="rounded-[var(--radius-row)] bg-[color-mix(in_srgb,var(--mismatch)_10%,white)] px-5 py-4 text-lg font-semibold text-mismatch">
          {error}
        </p>
      )}

      <div id="result" className="scroll-mt-6" aria-live="polite">
        {result && <ResultView result={result} />}
      </div>
    </div>
  );
}

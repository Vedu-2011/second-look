"use client";

import { ArrowLeft, Camera, ImageUp, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/button";
import { CheckingSteps, type StepState } from "@/components/checking-steps";
import { StepIndicator } from "@/components/step-indicator";
import { cn } from "@/lib/utils";

type Phase = "label" | "pill" | "checking" | "done";

// Phase 0: a local, fake state machine. Phase 2 swaps the timers for the real /api/check progress events.
const FAKE_STEP_MS = 1100;

const CAPTURE = {
  label: {
    step: 1,
    title: "Photo of the label",
    tip: "Fit the whole pharmacy label in the frame. Flat, in good light.",
    take: "Take label photo",
  },
  pill: {
    step: 2,
    title: "Photo of one pill",
    tip: "Put one pill on a plain surface, imprint side up, good light.",
    take: "Take pill photo",
  },
} as const;

export function CheckFlow() {
  const [phase, setPhase] = useState<Phase>("label");
  const [photos, setPhotos] = useState<{ label?: string; pill?: string }>({});
  const [steps, setSteps] = useState<StepState[]>(["waiting", "waiting", "waiting", "waiting"]);
  const headingRef = useRef<HTMLDivElement>(null);

  // Move focus to the new step's heading so keyboard and screen reader users follow along.
  // (Not on first load: that would skip past the header.)
  const movedRef = useRef(false);
  useEffect(() => {
    if (movedRef.current) headingRef.current?.focus();
    movedRef.current = true;
  }, [phase]);

  // Free every preview object URL when the user leaves the page.
  const urlsRef = useRef<string[]>([]);
  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const addPhoto = (which: "label" | "pill", url: string) => {
    urlsRef.current.push(url);
    setPhotos((p) => ({ ...p, [which]: url }));
  };

  useEffect(() => {
    if (phase !== "checking") return;
    const timers: number[] = [];
    for (let i = 0; i <= 4; i++) {
      timers.push(
        window.setTimeout(() => {
          setSteps((prev) => prev.map((_, j) => (j < i ? "done" : j === i ? "working" : "waiting")));
          if (i === 4) setPhase("done");
        }, i * FAKE_STEP_MS + 150),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  function restart() {
    setPhotos({});
    setSteps(["waiting", "waiting", "waiting", "waiting"]);
    setPhase("label");
  }

  if (phase === "label" || phase === "pill") {
    const which = phase;
    const c = CAPTURE[which];
    return (
      <div className="flex flex-col gap-7">
        <div ref={headingRef} tabIndex={-1} className="outline-none">
          <StepIndicator step={c.step} title={c.title} />
          <p className="mt-3 text-lg text-ink-soft">{c.tip}</p>
        </div>
        <Capture
          key={which}
          kind={which}
          photo={photos[which]}
          takeLabel={c.take}
          onPhoto={(url) => addPhoto(which, url)}
          onClear={() => setPhotos((p) => ({ ...p, [which]: undefined }))}
        />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {which === "pill" ? (
            <Button variant="ghost" onClick={() => setPhase("label")}>
              <ArrowLeft aria-hidden />
              Back to label
            </Button>
          ) : (
            <span />
          )}
          {photos[which] && (
            <Button
              size="lg"
              onClick={() => {
                if (which === "label") setPhase("pill");
                else {
                  setSteps(["working", "waiting", "waiting", "waiting"]);
                  setPhase("checking");
                }
              }}
            >
              {which === "label" ? "Next: photo of one pill" : "Check my pill"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <div ref={headingRef} tabIndex={-1} className="outline-none">
        <h1 className="text-3xl font-bold tracking-[-0.015em] text-ink">
          {phase === "checking" ? "Checking your pill…" : "Check finished"}
        </h1>
        <p className="mt-3 text-lg text-ink-soft">
          {phase === "checking" ? "This takes about ten seconds." : "Here's what we did."}
        </p>
      </div>
      <div className="flex gap-3">
        {[photos.label, photos.pill].map((src, i) =>
          src ? (
            // Local blob preview: next/image can't optimize object URLs.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={i === 0 ? "Your label photo" : "Your pill photo"}
              className="size-20 rounded-[var(--radius-row)] bg-foil object-cover shadow-[var(--shadow-soft)]"
            />
          ) : null,
        )}
      </div>
      <CheckingSteps states={steps} className="rounded-[var(--radius-photo)] bg-foil p-2 sm:p-3" />
      {phase === "done" && (
        <div className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <p className="text-lg font-bold text-ink">This is a preview of the checking screen.</p>
          <p className="mt-1 text-base text-ink-soft">
            Real results are coming in the next version. For now, see what a result looks like on a sample bottle.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link href="/samples" className={buttonVariants({ size: "default" })}>
              See sample results
            </Link>
            <Button variant="secondary" onClick={restart}>
              <RotateCcw aria-hidden />
              Start over
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Capture({
  kind,
  photo,
  takeLabel,
  onPhoto,
  onClear,
}: {
  kind: "label" | "pill";
  photo?: string;
  takeLabel: string;
  onPhoto: (url: string) => void;
  onClear: () => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file isn't a photo. Choose a JPG, PNG or HEIC picture.");
      return;
    }
    setError(null);
    onPhoto(URL.createObjectURL(file));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The amber camera frame: corner brackets like a viewfinder, on a foil well. */}
      <div
        className={cn(
          "relative grid place-items-center overflow-hidden rounded-[var(--radius-photo)] bg-foil",
          kind === "label" ? "aspect-[4/3]" : "aspect-square sm:aspect-[4/3]",
        )}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={kind === "label" ? "Your label photo" : "Your pill photo"}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 text-center text-ink-soft">
            <span className="grid size-16 place-items-center rounded-full bg-white text-ink shadow-[var(--shadow-soft)]">
              {kind === "label" ? <Camera className="size-7" aria-hidden /> : <PillGlyph />}
            </span>
            <span className="text-lg">{kind === "label" ? "Your label goes here" : "One pill goes here"}</span>
          </div>
        )}
        <Brackets />
      </div>

      {error && (
        <p role="alert" className="rounded-[var(--radius-row)] bg-[color-mix(in_srgb,var(--mismatch)_10%,white)] px-4 py-3 text-base font-semibold text-mismatch">
          {error}
        </p>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={handle} />
      <input ref={uploadRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={handle} />

      {photo ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="secondary" onClick={() => { onClear(); cameraRef.current?.click(); }}>
            <RotateCcw aria-hidden />
            Retake
          </Button>
          <Button variant="ghost" onClick={() => uploadRef.current?.click()}>
            <ImageUp aria-hidden />
            Choose a different photo
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="ink" onClick={() => cameraRef.current?.click()}>
            <Camera aria-hidden />
            {takeLabel}
          </Button>
          <Button variant="secondary" onClick={() => uploadRef.current?.click()}>
            <ImageUp aria-hidden />
            Upload a photo
          </Button>
        </div>
      )}
    </div>
  );
}

function Brackets() {
  const corner = "absolute size-10 border-amber sm:size-12";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-4 sm:inset-5">
      <span className={cn(corner, "top-0 left-0 rounded-tl-[14px] border-t-4 border-l-4")} />
      <span className={cn(corner, "top-0 right-0 rounded-tr-[14px] border-t-4 border-r-4")} />
      <span className={cn(corner, "bottom-0 left-0 rounded-bl-[14px] border-b-4 border-l-4")} />
      <span className={cn(corner, "right-0 bottom-0 rounded-br-[14px] border-r-4 border-b-4")} />
    </div>
  );
}

function PillGlyph() {
  return (
    <svg viewBox="0 0 28 28" className="size-7" aria-hidden>
      <ellipse cx="14" cy="14" rx="11" ry="7" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <text x="14" y="15" textAnchor="middle" dominantBaseline="central" fontSize="7" fontWeight="700" fill="currentColor" fontFamily="var(--font-mono)">
        I2
      </text>
    </svg>
  );
}

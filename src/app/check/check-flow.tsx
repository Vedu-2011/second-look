"use client";
/* eslint-disable @next/next/no-img-element */

import { ArrowLeft, Camera, ImageUp, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/button";
import { CheckingSteps, type StepState } from "@/components/checking-steps";
import { ResultView } from "@/components/result-view";
import { StepIndicator } from "@/components/step-indicator";
import type { CheckEvent } from "@/lib/check-input";
import type { CheckResult } from "@/lib/check-service";
import { cn } from "@/lib/utils";

type Phase = "label" | "pill" | "checking" | "flip" | "done" | "error";
type Photo = { preview: string; dataUrl: string };
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
  const [photos, setPhotos] = useState<{
    label?: Photo;
    pill?: Photo;
    otherSide?: Photo;
  }>({});
  const [steps, setSteps] = useState<StepState[]>([
    "waiting",
    "waiting",
    "waiting",
    "waiting",
  ]);
  const [continuation, setContinuation] = useState<{
    id: string;
    reason: string;
  } | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [explanation, setExplanation] = useState<{
    summary: string;
    pharmacyScript: string;
  } | null>(null);
  const [reading, setReading] = useState<{
    imprint?: string;
    colors?: string;
    shape?: string;
  }>({});
  const [earlyMessage, setEarlyMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const previousPhase = useRef<Phase>("label");
  const urlsRef = useRef<string[]>([]);
  useEffect(() => {
    if (previousPhase.current !== phase) headingRef.current?.focus();
    previousPhase.current = phase;
  }, [phase]);
  useEffect(
    () => () => urlsRef.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );
  const addPhoto = (which: "label" | "pill" | "otherSide", photo: Photo) => {
    urlsRef.current.push(photo.preview);
    setPhotos((p) => ({
      ...p,
      ...(which !== "otherSide" ? { otherSide: undefined } : {}),
      [which]: photo,
    }));
  };
  function restart(which?: "label" | "pill") {
    setContinuation(null);
    setResult(null);
    setExplanation(null);
    setEarlyMessage(null);
    setError(null);
    setReading({});
    setSteps(["waiting", "waiting", "waiting", "waiting"]);
    if (which)
      setPhotos((p) => ({ ...p, [which]: undefined, otherSide: undefined }));
    else setPhotos({});
    setPhase(which === "pill" ? "pill" : "label");
  }

  async function checkPhotos(skipFlip = false) {
    if (!photos.label || !photos.pill) return;
    setPhase("checking");
    setError(null);
    setEarlyMessage(null);
    setSteps(["working", "working", "waiting", "waiting"]);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 65000);
    let terminal = false;
    const receive = (event: CheckEvent) => {
      if (["result", "early_exit", "error", "flip"].includes(event.type))
        terminal = true;
      handleEvent(event);
    };
    try {
      const response = await fetch("/api/check", {
        signal: controller.signal,
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          continuation
            ? {
                continuationId: continuation.id,
                ...(skipFlip
                  ? { skipFlip: true }
                  : { otherSideImage: { dataUrl: photos.otherSide!.dataUrl } }),
              }
            : {
                labelImage: { dataUrl: photos.label.dataUrl },
                pillImage: { dataUrl: photos.pill.dataUrl },
              },
        ),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          body.error || "We couldn't start the check. Please try again.",
        );
      }
      if (!response.body)
        throw new Error("The check did not start. Please try again.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        buffer += decoder.decode(part.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines)
          if (line.trim()) receive(JSON.parse(line) as CheckEvent);
      }
      if (buffer.trim()) receive(JSON.parse(buffer) as CheckEvent);
      if (!terminal)
        throw new Error("The check ended early. Please try again.");
    } catch (err) {
      setError(
        controller.signal.aborted
          ? "That check took too long. Please try again or type what is on your pill."
          : err instanceof Error
            ? err.message
            : "We couldn't finish the check. Please try again.",
      );
      setPhase("error");
    } finally {
      clearTimeout(timer);
    }
  }
  function handleEvent(event: CheckEvent) {
    if (event.type === "flip") {
      setContinuation({ id: event.continuationId, reason: event.reason });
      setPhase("flip");
    }
    if (event.type === "step")
      setSteps((current) =>
        current.map((value, index) =>
          index === event.step ? event.state : value,
        ),
      );
    if (event.type === "reading" && event.kind === "pill") {
      const pill = event.value as CheckResult["pill"];
      setReading({
        imprint: pill.imprintSides.join(" / "),
        colors: pill.colors.join(" · "),
        shape: pill.shape,
      });
    }
    if (event.type === "early_exit") {
      setEarlyMessage(event.message);
      setPhase("done");
    }
    if (event.type === "error") {
      setError(event.message);
      setPhase("error");
    }
    if (event.type === "result") {
      setResult(event.result as CheckResult);
      setExplanation(
        event.explanation as { summary: string; pharmacyScript: string },
      );
      setPhase("done");
    }
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
          kind={which}
          photo={photos[which]}
          takeLabel={c.take}
          onPhoto={(photo) => addPhoto(which, photo)}
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
              onClick={() =>
                which === "label" ? setPhase("pill") : void checkPhotos()
              }
            >
              {which === "label" ? "Next: photo of one pill" : "Check my pill"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (phase === "flip")
    return (
      <div className="flex flex-col gap-6">
        <div ref={headingRef} tabIndex={-1} className="outline-none">
          <h1 className="text-3xl font-bold">
            Flip the pill over and take one more photo
          </h1>
          <p className="mt-3 text-lg text-ink-soft">
            {continuation?.reason} Keep the same pill, turn it over, and use
            good light.
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-[var(--radius-row)] bg-foil p-4">
          {photos.pill && (
            <img
              src={photos.pill.preview}
              alt="The first side you photographed"
              className="size-20 rounded-[var(--radius-row)] object-cover"
            />
          )}
          <p className="text-lg">
            First side:{" "}
            <span className="font-mono">
              {reading.imprint || "No imprint read"}
            </span>
          </p>
        </div>
        <Capture
          kind="pill"
          photo={photos.otherSide}
          takeLabel="Take other-side photo"
          onPhoto={(photo) => addPhoto("otherSide", photo)}
          onClear={() => setPhotos((p) => ({ ...p, otherSide: undefined }))}
        />
        <div className="flex flex-col gap-3">
          {photos.otherSide && (
            <Button size="lg" onClick={() => void checkPhotos()}>
              Compare both sides
            </Button>
          )}
          <Button variant="secondary" onClick={() => void checkPhotos(true)}>
            Skip: use the first photo
          </Button>
        </div>
        <p className="text-base text-ink-soft">
          Another view may help. If we still cannot tell, ask your pharmacist
          before taking the pill.
        </p>
      </div>
    );

  const shareId =
    result && (result as CheckResult & { shareId?: string }).shareId;
  return (
    <div className="flex flex-col gap-7">
      <div ref={headingRef} tabIndex={-1} className="outline-none">
        <h1 className="text-3xl font-bold tracking-[-0.015em] text-ink">
          {phase === "checking"
            ? "Checking your pill…"
            : phase === "error"
              ? "We couldn't finish the check"
              : earlyMessage
                ? "Let's try that photo again"
                : "Here is your result"}
        </h1>
        <p className="mt-3 text-lg text-ink-soft">
          {phase === "checking"
            ? "The four steps below are happening now."
            : "AI reads the photos. FDA records and code decide the result."}
        </p>
      </div>
      <div className="flex gap-3">
        {[photos.label, photos.pill, photos.otherSide].map((photo, i) =>
          photo ? (
            <img
              key={i}
              src={photo.preview}
              alt={i === 0 ? "Your label photo" : "Your pill photo"}
              className="size-20 rounded-[var(--radius-row)] bg-foil object-cover shadow-[var(--shadow-soft)]"
            />
          ) : null,
        )}
      </div>
      <CheckingSteps
        states={steps}
        className="rounded-[var(--radius-photo)] bg-foil p-2 sm:p-3"
      />
      {reading.imprint && !earlyMessage && (
        <div className="flex flex-wrap gap-2" aria-label="What the AI read">
          <span className="text-base font-semibold text-ink-soft">
            We read:
          </span>
          <span className="rounded-full bg-foil px-3 py-1 font-mono text-sm font-semibold text-ink">
            {reading.imprint}
          </span>
          {reading.colors && (
            <span className="rounded-full bg-foil px-3 py-1 text-sm font-semibold text-ink">
              {reading.colors}
            </span>
          )}
          <span className="rounded-full bg-foil px-3 py-1 text-sm font-semibold text-ink">
            {reading.shape}
          </span>
        </div>
      )}
      {earlyMessage && (
        <EarlyExit
          message={earlyMessage}
          onRetake={() =>
            restart(
              earlyMessage.includes("label") ||
                earlyMessage.includes("medicine")
                ? "label"
                : "pill",
            )
          }
        />
      )}
      {error && (
        <div
          role="alert"
          className="rounded-[var(--radius-photo)] bg-[color-mix(in_srgb,var(--mismatch)_8%,white)] p-5 text-lg font-semibold text-mismatch"
        >
          {error}
          <div className="mt-4">
            <Button variant="secondary" onClick={() => restart()}>
              Try again
            </Button>
          </div>
        </div>
      )}
      {result && (
        <>
          <ResultView
            result={result}
            photo={photos.pill?.preview}
            otherPhoto={photos.otherSide?.preview}
            explanation={explanation ?? undefined}
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" onClick={() => restart()}>
              <RotateCcw aria-hidden />
              Start over
            </Button>
            {shareId && (
              <Link
                href={`/result/${shareId}`}
                className={buttonVariants({ variant: "ghost" })}
              >
                Open shareable result
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function EarlyExit({
  message,
  onRetake,
}: {
  message: string;
  onRetake: () => void;
}) {
  return (
    <div className="rounded-[var(--radius-photo)] bg-[color-mix(in_srgb,var(--unsure)_8%,white)] p-5 sm:p-6">
      <p className="text-lg font-semibold text-ink">{message}</p>
      <div className="mt-4">
        <Button variant="secondary" onClick={onRetake}>
          <RotateCcw aria-hidden />
          Retake photo
        </Button>
      </div>
    </div>
  );
}
async function prepareImage(file: File): Promise<Photo> {
  if (
    !file.type.startsWith("image/") ||
    !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)
  )
    throw new Error(
      "That photo format isn't supported here. Choose a JPG, PNG, GIF, or WebP image.",
    );
  if (file.size > 15 * 1024 * 1024)
    throw new Error("That photo is too large. Choose a photo under 15 MB.");
  const preview = URL.createObjectURL(file);
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { preview, dataUrl: canvas.toDataURL("image/jpeg", 0.85) };
}
function Capture({
  kind,
  photo,
  takeLabel,
  onPhoto,
  onClear,
}: {
  kind: "label" | "pill";
  photo?: Photo;
  takeLabel: string;
  onPhoto: (photo: Photo) => void;
  onClear: () => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setError(null);
      onPhoto(await prepareImage(file));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "That photo couldn't be prepared.",
      );
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "relative grid place-items-center overflow-hidden rounded-[var(--radius-photo)] bg-foil",
          kind === "label" ? "aspect-[4/3]" : "aspect-square sm:aspect-[4/3]",
        )}
      >
        {photo ? (
          <img
            src={photo.preview}
            alt={kind === "label" ? "Your label photo" : "Your pill photo"}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 text-center text-ink-soft">
            <span className="grid size-16 place-items-center rounded-full bg-white text-ink shadow-[var(--shadow-soft)]">
              {kind === "label" ? (
                <Camera className="size-7" aria-hidden />
              ) : (
                <PillGlyph />
              )}
            </span>
            <span className="text-lg">
              {kind === "label" ? "Your label goes here" : "One pill goes here"}
            </span>
          </div>
        )}
        <Brackets />
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius-row)] bg-[color-mix(in_srgb,var(--mismatch)_10%,white)] px-4 py-3 text-base font-semibold text-mismatch"
        >
          {error}
        </p>
      )}
      <input
        ref={cameraRef}
        aria-label={kind === "label" ? "Take label photo" : "Take pill photo"}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handle}
      />
      <input
        ref={uploadRef}
        aria-label={kind === "label" ? "Upload label photo" : "Upload pill photo"}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handle}
      />
      {photo ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="secondary"
            onClick={() => {
              onClear();
              cameraRef.current?.click();
            }}
          >
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
          <Button
            variant="secondary"
            onClick={() => uploadRef.current?.click()}
          >
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
    <div
      aria-hidden
      className="pointer-events-none absolute inset-4 sm:inset-5"
    >
      <span
        className={cn(
          corner,
          "top-0 left-0 rounded-tl-[14px] border-t-4 border-l-4",
        )}
      />
      <span
        className={cn(
          corner,
          "top-0 right-0 rounded-tr-[14px] border-t-4 border-r-4",
        )}
      />
      <span
        className={cn(
          corner,
          "bottom-0 left-0 rounded-bl-[14px] border-b-4 border-l-4",
        )}
      />
      <span
        className={cn(
          corner,
          "right-0 bottom-0 rounded-br-[14px] border-r-4 border-b-4",
        )}
      />
    </div>
  );
}
function PillGlyph() {
  return (
    <svg viewBox="0 0 28 28" className="size-7" aria-hidden>
      <ellipse
        cx="14"
        cy="14"
        rx="11"
        ry="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <text
        x="14"
        y="15"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="7"
        fontWeight="700"
        fill="currentColor"
        fontFamily="var(--font-mono)"
      >
        I2
      </text>
    </svg>
  );
}

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepState = "waiting" | "working" | "done" | "failed";

export const CHECK_STEPS = [
  "Reading your label",
  "Reading the pill",
  "Looking up FDA records",
  "Comparing with FDA records",
] as const;

// The one orchestrated motion moment. Each line ticks as its step finishes.
// With reduced motion the spinner stands still (globals.css) and the ticks still land.
export function CheckingSteps({
  states,
  labels = CHECK_STEPS,
  className,
}: {
  states: StepState[];
  labels?: readonly string[];
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-col gap-1", className)} aria-label="Check progress" aria-live="polite" aria-atomic="true">
      {labels.map((label, i) => {
        const state = states[i] ?? "waiting";
        return (
          <li
            key={label}
            data-state={state}
            className={cn(
              "flex min-h-14 items-center gap-4 rounded-[var(--radius-row)] px-4 py-2.5 transition-colors duration-300",
              state === "working" && "bg-white shadow-[var(--shadow-soft)]",
            )}
          >
            <span aria-hidden className="relative grid size-8 shrink-0 place-items-center">
              {state === "waiting" && <span className="size-3 rounded-full bg-foil-deep" />}
              {state === "working" && (
                <span className="size-7 rounded-full border-[3px] border-foil-deep border-t-amber motion-safe:animate-spin" />
              )}
              {state === "done" && (
                <span className="grid size-8 place-items-center rounded-full bg-ink text-label motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:fade-in">
                  <Check className="size-[18px]" strokeWidth={3} />
                </span>
              )}
              {state === "failed" && (
                <span className="grid size-8 place-items-center rounded-full bg-mismatch text-white">
                  <X className="size-[18px]" strokeWidth={3} />
                </span>
              )}
            </span>
            <span
              className={cn(
                "text-lg",
                state === "waiting" && "text-ink-soft",
                state === "working" && "font-semibold text-ink",
                state === "done" && "text-ink",
                state === "failed" && "font-semibold text-mismatch",
              )}
            >
              {label}
              {state === "working" && "…"}
              <span className="sr-only">
                {state === "waiting" ? " (waiting)" : state === "working" ? " (in progress)" : state === "done" ? " (done)" : " (failed)"}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

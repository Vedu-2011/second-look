import { Check, CheckCheck, CircleHelp, X } from "lucide-react";
import { VERDICT_COPY, type Verdict } from "@/lib/verdict";
import { cn } from "@/lib/utils";

const ICONS = {
  MATCH: Check,
  SAME_MEDICINE_DIFFERENT_MAKER: CheckCheck,
  MISMATCH: X,
  UNSURE: CircleHelp,
} as const;

const TONES = {
  MATCH: "verdict-match",
  SAME_MEDICINE_DIFFERENT_MAKER: "verdict-same",
  MISMATCH: "verdict-mismatch",
  UNSURE: "verdict-unsure",
} as const;

// Tint + dark title + icon + instruction, readable without color vision.
export function VerdictField({
  verdict,
  instruction,
  className,
  compact = false,
}: {
  verdict: Verdict;
  /** Override the default one-line instruction (e.g. "This imprint belongs to …"). */
  instruction?: string;
  className?: string;
  compact?: boolean;
}) {
  const copy = VERDICT_COPY[verdict];
  const Icon = ICONS[verdict];
  return (
    <section
      role="status"
      aria-label={`Result: ${copy.word}`}
      data-verdict={verdict}
      className={cn(
        "verdict-field relative overflow-hidden rounded-[var(--radius-photo)]",
        TONES[verdict],
        compact ? "px-5 py-5" : "px-6 py-7 sm:px-9 sm:py-9",
        className,
      )}
    >
      <div className={cn("verdict-body flex items-start", compact ? "gap-3" : "gap-4 sm:gap-5")}>
        <span
          aria-hidden
          className={cn(
            "verdict-icon grid shrink-0 place-items-center rounded-full",
            compact ? "size-11" : "size-14 sm:size-16",
          )}
        >
          <Icon className={compact ? "size-6" : "size-8 sm:size-9"} strokeWidth={2.75} />
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "verdict-title font-bold tracking-[-0.03em] text-balance [overflow-wrap:anywhere]",
              compact ? "text-[1.5rem] leading-[1.08]" : "text-[clamp(2rem,6vw,3.5rem)] leading-[1.04]",
            )}
          >
            {copy.word}
          </p>
          <p className={cn("verdict-instruction text-pretty", compact ? "mt-2 text-sm" : "mt-4 text-base sm:text-lg")}>
            {instruction ?? copy.instruction}
          </p>
        </div>
      </div>
    </section>
  );
}

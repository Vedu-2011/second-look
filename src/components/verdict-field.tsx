import { Check, CheckCheck, CircleHelp, X } from "lucide-react";
import { VERDICT_COPY, type Verdict } from "@/lib/verdict";
import { cn } from "@/lib/utils";

const ICONS = {
  MATCH: Check,
  SAME_MEDICINE_DIFFERENT_MAKER: CheckCheck,
  MISMATCH: X,
  UNSURE: CircleHelp,
} as const;

const TONE_BG = {
  match: "bg-match",
  mismatch: "bg-mismatch",
  unsure: "bg-unsure",
} as const;

// The loudest thing on screen. Color + icon + word + instruction, so it works without color vision.
// All text is bold and ≥ 20px: white on --match is 4.35:1, which passes WCAG only as large text.
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
        "relative overflow-hidden rounded-[var(--radius-photo)] text-white shadow-[var(--shadow-lift)]",
        TONE_BG[copy.tone],
        compact ? "px-5 py-5" : "px-6 py-7 sm:px-9 sm:py-9",
        className,
      )}
    >
      <div className={cn("flex flex-col items-start sm:flex-row", compact ? "gap-3" : "gap-4 sm:gap-5")}>
        <span
          aria-hidden
          className={cn(
            "grid shrink-0 place-items-center rounded-full bg-white/18 ring-1 ring-white/25",
            compact ? "size-11" : "size-14 sm:size-16",
          )}
        >
          <Icon className={compact ? "size-6" : "size-8 sm:size-9"} strokeWidth={2.75} />
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "font-bold tracking-[-0.02em] text-balance [overflow-wrap:anywhere]",
              compact ? "text-[2rem] leading-[1.08]" : "text-[clamp(2.5rem,8vw,4.5rem)] leading-[1.04]",
            )}
          >
            {copy.word}
          </p>
          <p className={cn("font-bold text-pretty text-white", compact ? "mt-1.5 text-lg" : "mt-3 text-xl sm:text-2xl")}>
            {instruction ?? copy.instruction}
          </p>
        </div>
      </div>
    </section>
  );
}

import { ArrowUpRight } from "lucide-react";
import { dailyMedUrl, formatDate } from "@/lib/fda/fixtures";
import { cn } from "@/lib/utils";

// "FDA DailyMed · published Nov 6, 2026" — links to the exact label the comparison used.
export function SourceBadge({
  setid,
  publishedDate,
  className,
}: {
  setid: string;
  /** ISO date, e.g. "2026-11-06". Left out when DailyMed didn't give one. */
  publishedDate?: string | null;
  className?: string;
}) {
  return (
    <a
      href={dailyMedUrl(setid)}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "source-chip group inline-flex min-h-12 items-center gap-2 rounded-full bg-foil py-2 pr-4 pl-3 text-sm text-ink transition-colors hover:bg-foil-deep",
        className,
      )}
    >
      <span className="rounded-full bg-white px-2.5 py-1 text-sm font-bold text-ink shadow-[var(--shadow-soft)]">FDA</span>
      <span>
        <span className="font-semibold">DailyMed</span>
        <span className="text-ink-soft">{publishedDate ? ` · published ${formatDate(publishedDate)}` : " label"}</span>
      </span>
      <ArrowUpRight className="size-4 text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
      <span className="sr-only">(opens the FDA label in a new tab)</span>
    </a>
  );
}

// "RxNorm · ibuprofen 200 mg, every maker" — the National Library of Medicine's drug list.
export function RxNormBadge({ href, text, className }: { href: string; text: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "source-chip group inline-flex min-h-12 items-center gap-2 rounded-full bg-foil py-2 pr-4 pl-3 text-sm text-ink transition-colors hover:bg-foil-deep",
        className,
      )}
    >
      <span className="rounded-full bg-white px-2.5 py-1 text-sm font-bold text-ink shadow-[var(--shadow-soft)]">NLM</span>
      <span>
        <span className="font-semibold">RxNorm</span>
        <span className="text-ink-soft"> · {text}</span>
      </span>
      <ArrowUpRight className="size-4 text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

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
  /** ISO date, e.g. "2026-11-06" */
  publishedDate: string;
  className?: string;
}) {
  return (
    <a
      href={dailyMedUrl(setid)}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "group inline-flex min-h-12 items-center gap-2 rounded-[24px] bg-foil py-2 pr-4 pl-2 text-base text-ink transition-colors hover:bg-foil-deep",
        className,
      )}
    >
      <span className="rounded-full bg-white px-2.5 py-1 text-sm font-bold text-ink shadow-[var(--shadow-soft)]">FDA</span>
      <span>
        <span className="font-semibold">DailyMed</span>
        <span className="text-ink-soft"> · published {formatDate(publishedDate)}</span>
      </span>
      <ArrowUpRight className="size-4 text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
      <span className="sr-only">(opens the FDA label in a new tab)</span>
    </a>
  );
}

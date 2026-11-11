import { Check, CircleHelp, Minus, X } from "lucide-react";
import type { FeatureResult, FeatureRow } from "@/lib/verdict";
import { cn } from "@/lib/utils";

const RESULT = {
  match: { Icon: Check, label: "Matches", dot: "bg-match text-white" },
  mismatch: { Icon: X, label: "Doesn't match", dot: "bg-mismatch text-white" },
  unsure: { Icon: CircleHelp, label: "Can't tell", dot: "bg-unsure text-white" },
  not_measured: { Icon: Minus, label: "Not measured from a photo", dot: "bg-foil text-ink-soft" },
} satisfies Record<FeatureResult, unknown>;

// Imprint, color, shape, size: what the FDA record says vs what we saw. The failing row is tinted.
export function FeatureTable({ rows, className }: { rows: FeatureRow[]; className?: string }) {
  return (
    <table className={cn("feature-list w-full border-separate border-spacing-y-2 text-left", className)}>
      <caption className="sr-only">How your pill compares with the FDA record</caption>
      <thead>
        <tr className="text-sm text-ink-soft">
          <th scope="col" className="w-[30%] px-3 pb-1 font-semibold sm:px-4">
            <span className="sr-only">Feature</span>
          </th>
          <th scope="col" className="px-2 pb-1 font-semibold">
            FDA record
          </th>
          <th scope="col" className="px-2 pb-1 font-semibold">
            Your pill
          </th>
          <th scope="col" className="w-12 px-2 pb-1 sm:w-14">
            <span className="sr-only">Result</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const r = RESULT[row.result];
          const mono = row.name === "Imprint" || row.name === "Size";
          const tint =
            row.result === "mismatch"
              ? "bg-[color-mix(in_srgb,var(--mismatch)_10%,white)]"
              : row.result === "unsure"
                ? "bg-[color-mix(in_srgb,var(--unsure)_9%,white)]"
                : "bg-white";
          return (
            <tr key={row.name} data-result={row.result}>
              <th
                scope="row"
                className={cn("rounded-l-[var(--radius-row)] px-3 py-3.5 font-semibold text-ink sm:px-4", tint)}
              >
                {row.name}
              </th>
              <td className={cn("px-2 py-3.5 text-ink", tint, mono && "font-mono font-semibold")}>{row.expected}</td>
              <td
                className={cn(
                  "px-2 py-3.5",
                  tint,
                  row.result === "not_measured" ? "text-base text-ink-soft" : "text-ink",
                  mono && row.result !== "not_measured" && "font-mono font-semibold",
                )}
              >
                {row.found}
              </td>
              <td className={cn("rounded-r-[var(--radius-row)] px-2 py-3.5", tint)}>
                <span className={cn("ml-auto grid size-8 place-items-center rounded-full", r.dot)}>
                  <r.Icon className="size-[18px]" strokeWidth={3} aria-hidden />
                  <span className="sr-only">{r.label}</span>
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

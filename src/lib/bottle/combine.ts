// Phase 12: up to three photos of DIFFERENT pills from one bottle. Each photo is its own check; the bottle answer is
// the weakest of them. Red if any photo has a pill that doesn't match; green only if every photo is fully green.
import type { BottleDecision, BottleResult } from "./types";

export const MAX_PILL_PHOTOS = 3;
const RANK: Record<BottleDecision["verdict"], number> = { MATCH: 0, LOOKS_RIGHT: 1, FACE_DOWN: 2, UNSURE: 3, WARNING: 4, MISMATCH: 5 };

export type CombinedBottle = { verdict: BottleDecision["verdict"]; title: string; instruction: string; photo: number | null; pills: number };

export function combineBottle(results: readonly BottleResult[]): CombinedBottle {
  const pills = results.reduce((n, r) => n + r.pills.length, 0);
  if (results.length === 1) return { ...results[0].decision, photo: 1, pills };
  // The first photo with the weakest answer speaks for the bottle (a mismatch anywhere outranks everything).
  const worst = results.reduce((w, r, i) => RANK[r.decision.verdict] > RANK[results[w].decision.verdict] ? i : w, 0);
  const { verdict, title, instruction } = results[worst].decision;
  if (verdict === "MATCH") return { verdict, title: `All ${pills} pills in your ${results.length} photos match your label.`, instruction: "Check that every pill in each photo has a number. We only checked the pills we found.", photo: null, pills };
  if (verdict === "MISMATCH") return { verdict, title: `Photo ${worst + 1}: ${title}`, instruction: "Don't take any pills from this bottle; call your pharmacy.", photo: worst + 1, pills };
  return { verdict, title: `Photo ${worst + 1}: ${title}`, instruction, photo: worst + 1, pills };
}

// Look-alike groups inside one photo, from silhouettes only (no AI, no drug recognition).
// A pill is "odd" when its size, shape or color sits far outside the spread of the other pills in the SAME photo.
// The spread is measured per photo (median ± 4 robust standard deviations), so lighting and camera distance cancel
// out. Floors stop a near-identical bottle from flagging noise; caps stop a very mixed bottle hiding every outlier.
// Floors sit above the spread among IDENTICAL pills in the harsh synthetic scene in segment.test.ts (tilt that
// shrinks far pills 8%, shadows, folds, blur, JPEG): size 8.6%, shape 0.5%, color 0. Shape and color get extra room
// for score lines, imprints and glare that drawn pills don't have. The dev composites' odd pills differ by 13–36% in
// size, 66–83% in shape and 21–63 in color, far past the floors. Size is relative within the photo: no ruler, and
// never used to call a pill right.
import type { PillFeatures } from "./types";

export const LOOKALIKE = {
  /** Robust standard deviations from the group's middle before a pill counts as different. */
  spread: 4,
  floors: { size: Math.log(1.15), shape: Math.log(1.12), color: 8 },
  caps: { size: Math.log(1.4), shape: Math.log(1.3), color: 18 },
  /** Fewer pills than this and there is no "the others" to compare with. */
  minPills: 3,
  /** The main group must be a clear majority, or we don't call anything odd. */
  minGroupShare: 0.6,
} as const;

export type Difference = "shape" | "size" | "color";
export type Reference = { relativeArea: number; aspect: number; lab: [number, number, number] };
export type Tolerance = Record<Difference, number>;

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export function referenceOf(features: readonly PillFeatures[]): Reference {
  return { relativeArea: median(features.map((f) => f.relativeArea)), aspect: median(features.map((f) => f.aspect)), lab: [0, 1, 2].map((c) => median(features.map((f) => f.lab[c]))) as Reference["lab"] };
}
/** Lightness counts half: shadows and glare change it more than they change hue. */
export function deviations(f: PillFeatures, ref: Reference): Tolerance {
  return {
    size: Math.abs(Math.log(f.relativeArea / ref.relativeArea)),
    shape: Math.abs(Math.log(f.aspect / ref.aspect)),
    color: Math.hypot((f.lab[0] - ref.lab[0]) / 2, f.lab[1] - ref.lab[1], f.lab[2] - ref.lab[2]),
  };
}
const KINDS: Difference[] = ["shape", "size", "color"];
export function toleranceOf(features: readonly PillFeatures[], ref = referenceOf(features)): Tolerance {
  const devs = features.map((f) => deviations(f, ref));
  return Object.fromEntries(KINDS.map((k) => [k, Math.min(LOOKALIKE.caps[k], Math.max(LOOKALIKE.floors[k], LOOKALIKE.spread * 1.4826 * median(devs.map((d) => d[k]))))])) as Tolerance;
}
export const FLOORS: Tolerance = { ...LOOKALIKE.floors };
export function differencesFrom(f: PillFeatures, ref: Reference, tolerance: Tolerance): Difference[] {
  const d = deviations(f, ref);
  return KINDS.filter((k) => d[k] > tolerance[k]);
}
/** "a different shape and size", in plain words. */
export function describeDifferences(kinds: readonly Difference[]) {
  const words = KINDS.filter((k) => kinds.includes(k));
  return `a different ${words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : words[0]}`;
}
/** Odd ones out by index, or null when there is no clear main group to compare with. */
export function oddOnesOut(features: readonly (PillFeatures | undefined)[]) {
  const known = features.flatMap((f, i) => (f ? [{ f, i }] : []));
  if (known.length < LOOKALIKE.minPills) return null;
  const ref = referenceOf(known.map((k) => k.f)), tolerance = toleranceOf(known.map((k) => k.f), ref);
  const odd = new Map<number, Difference[]>();
  for (const { f, i } of known) { const kinds = differencesFrom(f, ref, tolerance); if (kinds.length) odd.set(i, kinds); }
  if ((known.length - odd.size) / known.length < LOOKALIKE.minGroupShare) return null;
  return { reference: ref, tolerance, odd };
}

// "Flip and snap again": find each pill of the second photo in the first one by position alone (no AI).
// The second photo can be a little closer, further, shifted or turned, so we fit one similarity transform
// (shift + scale + small turn) to the whole layout, then pair pills that land on each other. Anything we can't pair
// with confidence means the pills moved: the caller falls back to a fresh full check and says so.
import { FLOORS, differencesFrom, toleranceOf } from "./lookalike";
import type { BottleClump, BottlePill, BottleResult, NormalizedBox, PillFeatures } from "./types";

type Point = { x: number; y: number };
type Size = { width: number; height: number };
type Transform = { scale: number; cos: number; sin: number; tx: number; ty: number };
/** A pill landing further than this share of the typical gap between pills from any old pill is "moved". */
export const MATCH_TOLERANCE = 0.35;

const centerOf = (b: NormalizedBox, image: Size): Point => ({ x: (b.x + b.width / 2) * image.width, y: (b.y + b.height / 2) * image.height });
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
const apply = (t: Transform, p: Point): Point => ({ x: t.scale * (t.cos * p.x - t.sin * p.y) + t.tx, y: t.scale * (t.sin * p.x + t.cos * p.y) + t.ty });

/** Least-squares similarity transform taking `from` onto `to` (Umeyama, 2-D). */
function fit(from: Point[], to: Point[]): Transform {
  const n = from.length, mf = { x: 0, y: 0 }, mt = { x: 0, y: 0 };
  from.forEach((p, i) => { mf.x += p.x / n; mf.y += p.y / n; mt.x += to[i].x / n; mt.y += to[i].y / n; });
  let a = 0, b = 0, vf = 0, vt = 0;
  from.forEach((p, i) => { const fx = p.x - mf.x, fy = p.y - mf.y, tx = to[i].x - mt.x, ty = to[i].y - mt.y; a += fx * tx + fy * ty; b += fx * ty - fy * tx; vf += fx * fx + fy * fy; vt += tx * tx + ty * ty; });
  const angle = n > 1 ? Math.atan2(b, a) : 0, cos = Math.cos(angle), sin = Math.sin(angle);
  const scale = n > 1 && vf > 0 ? Math.sqrt(vt / vf) : 1;
  return { scale, cos, sin, tx: mt.x - scale * (cos * mf.x - sin * mf.y), ty: mt.y - scale * (sin * mf.x + cos * mf.y) };
}

/** Pairs next-photo points with previous-photo points. Only mutual nearest neighbours within tolerance pair up. */
export function matchLayouts(prev: Point[], next: Point[], typicalPillSize: number) {
  if (!prev.length || !next.length) return { pairs: [] as [number, number][], unmatchedPrev: prev.map((_, i) => i), unmatchedNext: next.map((_, i) => i), toPrev: (p: Point) => p };
  const gaps = prev.map((p, i) => Math.min(...prev.filter((_, j) => j !== i).map((q) => Math.hypot(p.x - q.x, p.y - q.y))));
  const tolerance = prev.length > 1 ? Math.min(MATCH_TOLERANCE * median(gaps), typicalPillSize) : typicalPillSize;
  // Start from a few guesses (same framing; middles lined up; middles and spreads lined up), refit each on its
  // confident pairs, and keep whichever pairs the most pills. Spreads alone mislead when a clump split in two.
  const spread = (ps: Point[]) => { const c = { x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length }; return { c, r: Math.sqrt(ps.reduce((s, p) => s + (p.x - c.x) ** 2 + (p.y - c.y) ** 2, 0) / ps.length) || 1 }; };
  const a = spread(prev), b = spread(next), scale = prev.length > 1 && next.length > 1 ? a.r / b.r : 1;
  const starts: Transform[] = [
    { scale: 1, cos: 1, sin: 0, tx: 0, ty: 0 },
    { scale: 1, cos: 1, sin: 0, tx: a.c.x - b.c.x, ty: a.c.y - b.c.y },
    { scale, cos: 1, sin: 0, tx: a.c.x - scale * b.c.x, ty: a.c.y - scale * b.c.y },
  ];
  const nearest = (p: Point, ps: Point[]) => ps.reduce((best, q, j) => { const d = Math.hypot(p.x - q.x, p.y - q.y); return d < best.d ? { j, d } : best; }, { j: -1, d: Infinity });
  const pairUp = (t: Transform) => { const mapped = next.map((p) => apply(t, p)), out: [number, number][] = []; mapped.forEach((p, i) => { const n = nearest(p, prev); if (n.d <= tolerance && nearest(prev[n.j], mapped).j === i) out.push([i, n.j]); }); return out; };
  let best = { t: starts[0], pairs: [] as [number, number][] };
  for (const start of starts) {
    let t = start, found = pairUp(t);
    for (let round = 0; round < 3 && found.length >= 2; round++) { t = fit(found.map(([i]) => next[i]), found.map(([, j]) => prev[j])); found = pairUp(t); }
    if (found.length > best.pairs.length) best = { t, pairs: found };
  }
  const t = best.t, pairs = best.pairs;
  const pairedNext = new Set(pairs.map(([i]) => i)), pairedPrev = new Set(pairs.map(([, j]) => j));
  return { pairs, unmatchedPrev: prev.map((_, j) => j).filter((j) => !pairedPrev.has(j)), unmatchedNext: next.map((_, i) => i).filter((i) => !pairedNext.has(i)), toPrev: (p: Point) => apply(t, p) };
}

export type FollowUpPlan =
  | { mode: "reread"; reused: Map<number, BottlePill>; reread: number[] }
  | { mode: "fresh"; reason: string };
type NextPhoto = { image: Size; boxes: NormalizedBox[]; features: PillFeatures[]; clumps: BottleClump[] };

/** Decides which pills of the second photo need reading again. Indices are into the second photo's pills. */
export function planFollowUp(previous: BottleResult, next: NextPhoto): FollowUpPlan {
  const moved = { mode: "fresh" as const, reason: "The pills moved too much to match them with your first photo, so we checked every pill again." };
  if (previous.decision.next === "pour_again") return { mode: "fresh", reason: "You poured the pills again, so we checked every pill again." };
  if (!previous.pills.length || !next.boxes.length) return moved;
  const prevCenters = previous.pills.map((p) => centerOf(p.box, previous.image)), nextCenters = next.boxes.map((b) => centerOf(b, next.image));
  const size = median(previous.pills.map((p) => Math.max(p.box.width * previous.image.width, p.box.height * previous.image.height)));
  const { pairs, unmatchedPrev, unmatchedNext, toPrev } = matchLayouts(prevCenters, nextCenters, size);
  if (unmatchedPrev.length) return moved;
  // New pills are fine only where the first photo had touching pills that are now apart.
  const inClump = (i: number) => {
    const p = toPrev(nextCenters[i]);
    return (previous.clumps ?? []).some(({ box }) => { const pad = 0.25; const x = box.x * previous.image.width, y = box.y * previous.image.height, w = box.width * previous.image.width, h = box.height * previous.image.height; return p.x >= x - w * pad && p.x <= x + w * (1 + pad) && p.y >= y - h * pad && p.y <= y + h * (1 + pad); });
  };
  if (unmatchedNext.some((i) => !inClump(i))) return moved;
  // Every kept reading must still look like the same pill: a swapped pill is not "the same position".
  const tolerance = next.features.length >= 3 ? toleranceOf(next.features) : FLOORS;
  const asked = new Set(previous.decision.asks ?? []);
  const reused = new Map<number, BottlePill>(), reread: number[] = [...unmatchedNext];
  for (const [i, j] of pairs) {
    const before = previous.pills[j], after = next.features[i];
    if (!before.features || !after) return moved;
    const ref = { relativeArea: before.features.relativeArea, aspect: before.features.aspect, lab: before.features.lab };
    if (differencesFrom(after, ref, tolerance).some((k) => k !== "color" || !asked.has(before.number))) return moved;
    if (asked.has(before.number)) reread.push(i); else reused.set(i, before);
  }
  return { mode: "reread", reused, reread: reread.sort((a, b) => a - b) };
}

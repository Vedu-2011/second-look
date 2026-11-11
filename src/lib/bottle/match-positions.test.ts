import { describe, expect, it } from "vitest";
import { SAMPLE_RESULTS } from "@/lib/sample-results";
import { matchLayouts, planFollowUp } from "./match-positions";
import type { BottleResult, PillFeatures } from "./types";

const look = (i: number, over: Partial<PillFeatures> = {}): PillFeatures => ({ length: 128, width: 70, aspect: 1.83 + (i % 3) * 0.01, area: 0.0066, relativeArea: 1 + (i % 3) * 0.02, lab: [91, 2.6, 17 + (i % 3) * 0.5], ...over });
const points = Array.from({ length: 10 }, (_, i) => ({ x: 160 + (i % 5) * 220, y: 300 + Math.floor(i / 5) * 360 }));
const turn = (p: { x: number; y: number }, deg: number, scale = 1, dx = 0, dy = 0) => { const a = (deg * Math.PI) / 180; return { x: scale * (p.x * Math.cos(a) - p.y * Math.sin(a)) + dx, y: scale * (p.x * Math.sin(a) + p.y * Math.cos(a)) + dy }; };
const box = (p: { x: number; y: number }) => ({ x: (p.x - 60) / 1200, y: (p.y - 35) / 1000, width: 120 / 1200, height: 70 / 1000 });
function previous(asks: number[] = [], extra: Partial<BottleResult> = {}): BottleResult {
  return { kind: "bottle", label: SAMPLE_RESULTS[0].result.label, image: { width: 1200, height: 1000 }, checkedAt: "", elapsedMs: 0, usage: [],
    pills: points.map((p, i) => ({ number: i + 1, box: box(p), result: SAMPLE_RESULTS[0].result, features: look(i) })),
    decision: { verdict: "FACE_DOWN", title: "", instruction: "", matched: 10 - asks.length, unreadable: asks.length, flagged: [], asks, next: asks.length ? "flip" : undefined }, ...extra };
}
const nextPhoto = (ps: { x: number; y: number }[], features = ps.map((_, i) => look(i))) => ({ image: { width: 1200, height: 1000 }, boxes: ps.map(box), features, clumps: [] });

describe("matching pills between two photos by position", () => {
  it.each([["the same spot", 0, 1, 0, 0], ["shifted and closer", 0, 1.06, 40, -25], ["turned a little", 4, 1, 30, -40]])("pairs every pill: %s", (_name, deg, scale, dx, dy) => {
    const moved = points.map((p) => turn(p, deg as number, scale as number, dx as number, dy as number));
    const { pairs, unmatchedNext, unmatchedPrev } = matchLayouts(points, moved, 120);
    expect(unmatchedNext).toEqual([]); expect(unmatchedPrev).toEqual([]);
    expect(pairs.every(([i, j]) => i === j)).toBe(true);
  });
  it("re-reads only the pills we asked to flip", () => {
    const plan = planFollowUp(previous([4, 9]), nextPhoto(points.map((p) => turn(p, 2, 1.03, 10, 10))));
    expect(plan.mode).toBe("reread");
    if (plan.mode === "reread") { expect(plan.reread).toEqual([3, 8]); expect(plan.reused.size).toBe(8); }
  });
  it("a removed, added or swapped pill means a fresh full check", () => {
    expect(planFollowUp(previous([4]), nextPhoto(points.slice(1))).mode).toBe("fresh");
    expect(planFollowUp(previous([4]), nextPhoto([...points, { x: 600, y: 120 }])).mode).toBe("fresh");
    const swapped = points.map((_, i) => look(i, i === 6 ? { relativeArea: 0.6, aspect: 1.1 } : {}));
    expect(planFollowUp(previous([4]), nextPhoto(points, swapped)).mode).toBe("fresh");
    expect(planFollowUp(previous([4]), nextPhoto(points.map((p, i) => (i === 0 ? { x: 600, y: 120 } : p)))).mode).toBe("fresh");
  });
  it("after 'pour again', always checks every pill", () => {
    const poured = previous([], { decision: { ...previous().decision, next: "pour_again" } });
    expect(planFollowUp(poured, nextPhoto(points))).toMatchObject({ mode: "fresh", reason: "You poured the pills again, so we checked every pill again." });
  });
});

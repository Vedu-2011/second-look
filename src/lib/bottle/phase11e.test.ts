// Phase 11e: every mark sits ON its own pill. For every chip or dot, the nearest pill is its own pill.
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { capsuleDistance, layoutMarks, pillShape, RING_PAD, undrawable, type MarkInput } from "./overlay";
import { segmentBottle } from "./segment";
import type { NormalizedBox, PillOutline } from "./types";
import real from "./fixtures/phase11e-real-marks.json";

type Scene = { name: string; image: { width: number; height: number }; pills: { number: number; verdict: string; box: NormalizedBox; outline?: PillOutline; fromPile?: boolean; boxGuessed?: boolean }[]; unread: NormalizedBox[] };
const scenes = real as Scene[];

function check(scene: Scene, width: number, red: boolean) {
  const size = { width, height: width * scene.image.height / scene.image.width }, chip = width < 560 ? 24 : 28;
  const hidden = undrawable(scene.pills);
  const inputs: MarkInput[] = scene.pills.map((p, i) => ({ box: p.box, outline: p.outline, draw: !hidden[i], chip: !red || p.verdict === "MISMATCH" }));
  const marks = layoutMarks(inputs, size, chip, scene.unread);
  const shapes = scene.pills.map((p) => pillShape(p.box, p.outline, size)), blocks = scene.unread.map((b) => pillShape(b, undefined, size));
  const placed: { x: number; y: number; r: number }[] = [];
  marks.forEach((m, i) => {
    if (!inputs[i].draw) { expect(m.shape).toBeNull(); expect(m.chip ?? m.dot).toBeNull(); return; }
    if (!inputs[i].chip) { expect(m.chip ?? m.dot).toBeNull(); return; }
    const at = m.chip ?? m.dot; if (!at) return;
    const r = m.chip ? chip / 2 : 5, own = capsuleDistance(at, shapes[i]);
    // Touches its own ring: just outside the pill, never on it.
    expect(own).toBeGreaterThan(RING_PAD + r - 0.5); expect(own).toBeLessThan(RING_PAD + r + 2.5);
    // The invariant: no other pill (or unread region) is as close as its own pill, and it covers none of them.
    shapes.forEach((s, j) => { if (j !== i) { expect(capsuleDistance(at, s)).toBeGreaterThan(own); expect(capsuleDistance(at, s)).toBeGreaterThan(r); } });
    for (const b of blocks) expect(capsuleDistance(at, b)).toBeGreaterThan(Math.max(own, r));
    for (const q of placed) expect(Math.hypot(q.x - at.x, q.y - at.y)).toBeGreaterThanOrEqual(q.r + r);
    placed.push({ ...at, r });
  });
  return marks;
}

describe("phase 11e: marks on the pill itself", () => {
  for (const scene of scenes) for (const width of [343, 1000]) for (const red of [false, true]) {
    it(`${scene.name} at ${width}px${red ? ", red mode" : ""}: every chip's nearest pill is its own`, () => {
      const marks = check(scene, width, red);
      const chips = marks.filter((m) => m.chip).length;
      if (red) expect(chips).toBeLessThanOrEqual(scene.pills.filter((p) => p.verdict === "MISMATCH").length);
    });
  }
  it("the wrong pill always gets a ring, and in red mode it is the only chip", () => {
    for (const scene of scenes) {
      const wrong = scene.pills.findIndex((p) => p.verdict === "MISMATCH");
      if (wrong < 0) continue;
      const marks = check(scene, 343, true);
      expect(marks[wrong].shape).not.toBeNull();
      expect(marks.filter((m, i) => i !== wrong && (m.chip || m.dot))).toHaveLength(0);
    }
  });
  it("on Vedhanth's photo the Tylenol's mark is on the Tylenol, not the dashed softgel beside it", () => {
    const scene = scenes[2], tylenol = scene.pills.findIndex((p) => p.number === 5);
    const size = { width: 343, height: 343 * scene.image.height / scene.image.width };
    const marks = check(scene, 343, true), at = marks[tylenol].chip ?? marks[tylenol].dot;
    expect(at).not.toBeNull();
    const own = capsuleDistance(at!, pillShape(scene.pills[tylenol].box, undefined, size));
    for (const b of scene.unread) expect(capsuleDistance(at!, pillShape(b, undefined, size))).toBeGreaterThan(own);
  });
  it("separate pills are ringed from their measured outline: the ring's center is the pill's center", async () => {
    const r = await segmentBottle(await readFile("test-images/real/bottle/pills.jpg"));
    expect(r.outlines).toHaveLength(r.boxes.length);
    r.outlines!.forEach((o, i) => { const b = r.boxes[i]; expect(o.cx).toBeGreaterThan(b.x); expect(o.cx).toBeLessThan(b.x + b.width); expect(o.cy).toBeGreaterThan(b.y); expect(o.cy).toBeLessThan(b.y + b.height); expect(o.length).toBeGreaterThanOrEqual(o.width); });
  }, 20000);
  it("synthetic crowded scenes: 20 pills packed tight at random angles", () => {
    let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let t = 0; t < 25; t++) {
      const pills = Array.from({ length: 20 }, (_, k) => {
        const cx = 0.12 + (k % 5) * 0.19 + (rand() - 0.5) * 0.04, cy = 0.1 + Math.floor(k / 5) * 0.22 + (rand() - 0.5) * 0.04;
        const length = 0.1 + rand() * 0.05, width = length * (0.35 + rand() * 0.3), angle = rand() * Math.PI;
        const ex = Math.abs(Math.cos(angle)) * length / 2 + width / 2, ey = (Math.abs(Math.sin(angle)) * length / 2 + width / 2) * 0.75;
        return { number: k + 1, verdict: k === 13 ? "MISMATCH" : rand() < 0.5 ? "MATCH" : "UNSURE", outline: { cx, cy, angle, length, width }, box: { x: cx - ex, y: cy - ey, width: 2 * ex, height: 2 * ey } };
      });
      for (const red of [false, true]) check({ name: "synthetic", image: { width: 3000, height: 4000 }, pills, unread: [{ x: 0.4, y: 0.42, width: 0.12, height: 0.08 }] }, 343, red);
    }
  });
  it("never draws on a guessed spot: guessed, oversized or doubled pile boxes get no mark", () => {
    const b = (x: number, w = 0.1): NormalizedBox => ({ x, y: 0.4, width: w, height: 0.1 });
    expect(undrawable([{ box: b(0.1) }, { box: b(0.3) }, { box: b(0.5), fromPile: true, boxGuessed: true }, { box: b(0.6, 0.35), fromPile: true }, { box: b(0.305), fromPile: true }, { box: { x: 0.8, y: 0.7, width: 0.1, height: 0.1 }, fromPile: true }]))
      .toEqual([false, false, true, true, true, false]);
  });
});

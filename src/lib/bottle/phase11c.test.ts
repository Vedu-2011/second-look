// Phase 11c: piles are read (not coached away), wording leads with what couldn't be read, and the result screen rules.
import { describe, expect, it } from "vitest";
import { SAMPLE_RESULTS } from "@/lib/sample-results";
import type { AiPillGroupReading } from "@/lib/ai/schemas";
import { annotatePills, decideBottle } from "./decide-bottle";
import { bottleLegend, markerState, otherPillsLine } from "./display";
import { layoutPins } from "./overlay";
import { PARTLY_HIDDEN_CONFIDENCE_CAP, pileCropBox, pilePills, pilesToRead, MAX_PILES } from "./pile";
import type { BottleClump, BottlePill, PillFeatures } from "./types";

const pill = (number: number, verdict: BottlePill["result"]["verdict"] = "MATCH", extra: Partial<BottlePill> = {}): BottlePill =>
  ({ number, box: { x: 0.05 + number * 0.08, y: 0.1, width: 0.05, height: 0.05 }, result: { ...structuredClone(SAMPLE_RESULTS[0].result), verdict }, ...extra });
const pile = (read: number, count = read, countConfidence = 0.9, mayBeHidden = false): BottleClump =>
  ({ kind: "touching", box: { x: 0.4, y: 0.5, width: 0.2, height: 0.2 }, pile: { read, count, countConfidence, mayBeHidden } });
const unread: BottleClump = { kind: "touching", box: { x: 0.3, y: 0.4, width: 0.4, height: 0.4 } };
const entry = (x: number, y: number, extra: Partial<AiPillGroupReading["pills"][number]> = {}): AiPillGroupReading["pills"][number] =>
  ({ center: { x, y }, box: { x: x - 0.1, y: y - 0.1, width: 0.2, height: 0.2 }, imprintSides: ["IB 200"], imprintConfidence: 0.9, colors: ["turquoise"], colorConfidence: 0.9, shape: "oval", shapeConfidence: 0.9, form: "softgel", partlyHidden: false, photoProblems: [], ...extra });

describe("1. the pile reader's pills", () => {
  it("map from crop fractions back onto the photo", () => {
    const box = { x: 0.4, y: 0.4, width: 0.2, height: 0.2 }, crop = pileCropBox(box);
    const { pills, pile } = pilePills({ pills: [entry(0.5, 0.5)], pileCount: 1, countConfidence: 0.9, somePillsMayBeHidden: false }, 0, box, []);
    expect(pills[0].box.x + pills[0].box.width / 2).toBeCloseTo(crop.x + crop.width / 2, 5);
    expect(pile).toEqual({ read: 1, count: 1, countConfidence: 0.9, mayBeHidden: false });
  });
  it("drop a pill the segmenter already numbered (the padded crop can include a neighbour) and duplicates", () => {
    const box = { x: 0.4, y: 0.4, width: 0.2, height: 0.2 }, crop = pileCropBox(box);
    const neighbour = { x: crop.x, y: crop.y, width: crop.width * 0.2, height: crop.height * 0.2 };
    const { pills } = pilePills({ pills: [entry(0.1, 0.1), entry(0.5, 0.5), entry(0.51, 0.5)], pileCount: 3, countConfidence: 0.9, somePillsMayBeHidden: false }, 0, box, [neighbour]);
    expect(pills).toHaveLength(1);
  });
  it("a partly hidden pill can't reach the engine's 0.7 imprint bar", () => {
    const { pills } = pilePills({ pills: [entry(0.5, 0.5, { partlyHidden: true, imprintConfidence: 0.95 })], pileCount: 1, countConfidence: 0.9, somePillsMayBeHidden: false }, 0, { x: 0.4, y: 0.4, width: 0.2, height: 0.2 }, []);
    expect(pills[0].reading.imprintConfidence).toBe(PARTLY_HIDDEN_CONFIDENCE_CAP); expect(PARTLY_HIDDEN_CONFIDENCE_CAP).toBeLessThan(0.7);
  });
  it(`reads at most ${MAX_PILES} touching regions, largest first, never edge cutoffs`, () => {
    const c = (size: number, kind: BottleClump["kind"] = "touching"): BottleClump => ({ kind, box: { x: 0, y: 0, width: size, height: size } });
    expect(pilesToRead([c(0.1), c(0.3, "cutoff"), c(0.2), c(0.15), c(0.05)])).toEqual([2, 3, 0]);
  });
  it("a photo with a pile is never solid green: at best Looks right, with the hidden-pill line", () => {
    const pills = [pill(1), pill(2), pill(3, "MATCH", { fromPile: true }), pill(4, "MATCH", { fromPile: true })];
    const d = decideBottle(pills, [pile(2)]);
    expect(d.verdict).toBe("LOOKS_RIGHT");
    expect(d.instruction).toContain("Some pills were touching. We read 2 in the pile; a pill hidden under another can't be seen.");
  });
  it.each([["the reader says pills may be hidden", pile(2, 2, 0.9, true)], ["the count is a guess", pile(2, 2, 0.4)], ["it counted more than it could read", pile(2, 4)]])("UNSURE when %s", (_name, c) => {
    const d = decideBottle([pill(1), pill(2), pill(3, "MATCH", { fromPile: true }), pill(4, "MATCH", { fromPile: true })], [c]);
    expect(d.verdict).toBe("UNSURE"); expect(d.instruction).toBe("Some may be hidden under others — give the pile a shake and snap again."); expect(d.next).toBe("pour_again");
  });
  it("a MISMATCH from a pile pill is red exactly like any other pill", () => {
    expect(decideBottle([pill(1), pill(2, "MISMATCH", { fromPile: true })], [pile(1, 1, 0.9, true)]).verdict).toBe("MISMATCH");
  });
});

describe("2. lead with the problem when most of the photo is unread", () => {
  it("one separate pill + one big unread clump never leads with '1 pill matches'", () => {
    const d = decideBottle([pill(1)], [unread]);
    expect(d.verdict).toBe("UNSURE"); expect(d.title).toMatch(/^We could read 1 of about \d+ pills\.$/); expect(d.title).not.toContain("1 pill matches");
  });
  it("a small unread corner of a mostly read photo keeps the usual wording", () => {
    const pills = Array.from({ length: 8 }, (_, i) => pill(i + 1));
    expect(decideBottle(pills, [{ kind: "touching", box: { x: 0.5, y: 0.5, width: 0.05, height: 0.1 } }]).title).toBe("8 pills match. Some pills weren't checked.");
  });
});

describe("3. any region nobody read blocks green and Looks right", () => {
  it.each([["a touching clump", unread], ["an edge cutoff", { kind: "cutoff", box: { x: 0, y: 0, width: 0.05, height: 0.05 } } as BottleClump], ["a minor edge note", { kind: "cutoff", minor: true, box: { x: 0, y: 0, width: 0.02, height: 0.02 } } as BottleClump]])("%s", (_name, c) => {
    const pills = Array.from({ length: 6 }, (_, i) => pill(i + 1));
    expect(["MATCH", "LOOKS_RIGHT"]).not.toContain(decideBottle(pills, [c]).verdict);
    expect(["MATCH", "LOOKS_RIGHT"]).not.toContain(decideBottle([...pills, pill(7, "MATCH", { fromPile: true })], [pile(1), c]).verdict);
  });
  it("the legend lists every mark on screen, including the dashed circle", () => {
    expect(bottleLegend([pill(1), pill(2, "UNSURE")], [unread], false).map((l) => l.label)).toEqual(["Matches", "Can't tell", "Not read"]);
    expect(bottleLegend([pill(1)], [], false).map((l) => l.label)).toEqual(["Matches"]);
  });
});

describe("5. pins never overlap each other or cover a pill", () => {
  it("spreads pins for a tight row of pills", () => {
    const boxes = Array.from({ length: 10 }, (_, i) => ({ x: 0.1 + i * 0.07, y: 0.45, width: 0.06, height: 0.08 }));
    const pins = layoutPins(boxes, { width: 375, height: 500 }, 28);
    for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) expect(Math.hypot((pins[i].x - pins[j].x) * 375, (pins[i].y - pins[j].y) * 500)).toBeGreaterThanOrEqual(28);
    for (const p of pins) for (const b of boxes) expect(p.x * 375 > b.x * 375 - 14 && p.x * 375 < (b.x + b.width) * 375 + 14 && p.y * 500 > b.y * 500 - 14 && p.y * 500 < (b.y + b.height) * 500 + 14).toBe(false);
  });
});

describe("6. red mode is about the wrong pill only", () => {
  it("other pills dim, and one line sums them up", () => {
    const pills = [pill(1), pill(2), pill(3, "UNSURE"), pill(4, "MISMATCH")];
    expect(markerState(pills[0], true)).toBe("dimMatch"); expect(markerState(pills[2], true)).toBe("dim"); expect(markerState(pills[3], true)).toBe("mismatch");
    expect(otherPillsLine(pills)).toBe("The other 3 pills: 2 match, 1 not fully checked — it doesn't matter now, this bottle has a wrong pill.");
  });
  it("only the unidentified wrong pill is asked about", () => {
    const pills = [pill(1, "UNSURE"), pill(2, "MISMATCH")];
    expect(decideBottle(annotatePills(pills)).asks).toEqual([2]);
  });
});

describe("7. shape alone never flags a pill whose imprint is confirmed", () => {
  const look = (aspect: number, lab: [number, number, number] = [60, 10, 10], relativeArea = 1): PillFeatures => ({ length: 100, width: 100 / aspect, aspect, area: 0.01, relativeArea, lab });
  const group = (odd: PillFeatures, verdict: BottlePill["result"]["verdict"] = "MATCH") => annotatePills([...Array.from({ length: 6 }, (_, i) => pill(i + 1, "MATCH", { features: look(2) })), pill(7, verdict, { features: odd })]);
  it("shape-only on a confirmed pill → a note, the bottle stays as it was", () => {
    const pills = group(look(1.2)); expect(pills[6].odd).toBeUndefined(); expect(pills[6].shapeNote).toBe(true);
    expect(decideBottle(pills).verdict).toBe("MATCH");
  });
  it("size or color odd, or an unconfirmed imprint, is unchanged", () => {
    expect(group(look(2, [20, 40, -40]))[6].odd).toContain("color");
    expect(group(look(1.2), "UNSURE")[6].odd).toContain("shape");
  });
});

describe("8. a small dark object cut off at the edge", () => {
  it("is a note, not a circle, and still never green", () => {
    const minor: BottleClump = { kind: "cutoff", minor: true, box: { x: 0.97, y: 0.5, width: 0.03, height: 0.05 } };
    const d = decideBottle([pill(1), pill(2)], [minor]);
    expect(d.verdict).not.toBe("MATCH"); expect(d.instruction).toContain("Something at the edge of the photo wasn't checked");
    expect(bottleLegend([pill(1)], [minor], false).map((l) => l.label)).toEqual(["Matches"]);
  });
});

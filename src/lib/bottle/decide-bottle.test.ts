import { describe, expect, it } from "vitest";
import { SAMPLE_RESULTS } from "@/lib/sample-results";
import { annotatePills, appearanceWarning, decideBottle, MAX_FLIP_ASKS } from "./decide-bottle";
import type { BottlePill, PillFeatures } from "./types";
const pill = (number: number, verdict: BottlePill["result"]["verdict"] = "MATCH"): BottlePill => ({ number, box: { x: .1, y: .1, width: .1, height: .1 }, result: { ...structuredClone(SAMPLE_RESULTS[0].result), verdict } });

describe("whole-bottle rules preserve single-pill verdicts", () => {
  it("one engine mismatch makes the bottle red and names only engine-identified medicine", () => {
    const pills = [pill(1), pill(7, "MISMATCH")];
    const red = decideBottle(pills);
    expect(red.verdict).toBe("MISMATCH"); expect(red.flagged).toContain(7); expect(red.instruction).toContain("Don't take any pills");
    expect(red.instruction).not.toContain("acetaminophen");
    pills[1].result.identifiedAs = { ...pills[1].result.labelProduct!, title: "Example verified medicine" };
    expect(decideBottle(pills).instruction).toContain("Example verified medicine");
  });
  it("all matches and same-medicine pills are green, qualified as detected only", () => {
    const result = decideBottle([pill(1), pill(2, "SAME_MEDICINE_DIFFERENT_MAKER")]);
    expect(result.verdict).toBe("MATCH"); expect(result.title).toBe("All 2 pills we found match your label."); expect(result.instruction).toContain("every pill");
  });
  it("a confident color-only outlier stays UNSURE per pill with a bottle warning", () => {
    const p = pill(7, "UNSURE"); p.result.pill = { ...p.result.pill, imprintSides: [], imprintConfidence: 0, colors: ["blue"], colorConfidence: .99, shape: "oval", shapeConfidence: .9 };
    expect(appearanceWarning(p)).toContain("blue");
    const result = decideBottle([pill(1), p]); expect(result.verdict).toBe("WARNING"); expect(result.title).toContain("Pill 7"); expect(p.result.verdict).toBe("UNSURE");
  });
  it("a shape-only outlier warns, unknown/low confidence and close appearances don't", () => {
    // Label product: white metformin oval (sample 0).
    const p = pill(2, "UNSURE"); p.result.pill = { ...p.result.pill, colors: ["white"], colorConfidence: .9, shape: "round", shapeConfidence: .99 };
    expect(decideBottle([p]).verdict).toBe("WARNING");
    p.result.pill.shapeConfidence = .2; expect(appearanceWarning(p)).toBeUndefined();
    p.result.pill.shape = "capsule"; p.result.pill.shapeConfidence = .9; expect(appearanceWarning(p)).toBeUndefined();
    p.result.pill.colors = ["off-white"]; expect(appearanceWarning(p)).toBeUndefined();
    p.result.pill.colors = ["blue"]; p.result.pill.colorConfidence = .1; expect(appearanceWarning(p)).toBeUndefined();
  });
  it("does not compare a no-NDC typical look as if it were the label's exact product", () => {
    const p = pill(1, "UNSURE"); p.result.labelProduct = null; p.result.pill.colors = ["white"];
    expect(appearanceWarning(p)).toBeUndefined(); expect(decideBottle([p]).verdict).toBe("UNSURE");
  });
  it("some unreadable pills and zero pills never turn the bottle green", () => {
    const result = decideBottle([pill(1), pill(2, "UNSURE")]);
    expect(result.verdict).toBe("UNSURE"); expect(result.matched).toBe(1); expect(result.instruction).toContain("Flip");
    expect(decideBottle([]).verdict).toBe("UNSURE");
  });
});

// Silhouette numbers like the real G 12 bottle: small pill-to-pill wobble, as a camera gives.
const look = (i: number, over: Partial<PillFeatures> = {}): PillFeatures => ({ length: 128, width: 70, aspect: 1.83 + ((i * 7) % 5 - 2) * 0.015, area: 0.0066, relativeArea: 1 + ((i * 3) % 5 - 2) * 0.02, lab: [91 + ((i * 5) % 3 - 1), 2.6, 17 + ((i * 11) % 5 - 2) * 0.6], ...over });
const blank = (number: number, features = look(number)) => { const p = pill(number, "UNSURE"); p.features = features; p.result.pill = { ...p.result.pill, imprintSides: [], imprintConfidence: 0, pillVisible: true }; return p; };
const bottle = (count: number, change: (p: BottlePill) => BottlePill = (p) => p) => Array.from({ length: count }, (_, i) => change({ ...pill(i + 1), features: look(i + 1) }));

describe("pour and snap: look-alikes, face-down pills and what we ask for (phase 10)", () => {
  it("green only when every pill we found is confirmed, with plain wording", () => {
    const d = decideBottle(annotatePills(bottle(10)));
    expect(d).toMatchObject({ verdict: "MATCH", title: "All 10 pills we found match your label." });
    expect(d.instruction).toContain("every pill in your photo has a number");
  });
  it("a blank pill that looks like the confirmed ones is face-down: calm, not confirmed, asks for one flip", () => {
    const pills = annotatePills(bottle(10, (p) => (p.number === 4 ? blank(4) : p)));
    expect(pills[3].faceDown).toBe(true);
    const d = decideBottle(pills);
    expect(d).toMatchObject({ verdict: "FACE_DOWN", title: "9 pills match. 1 has its writing face-down.", instruction: "Flip pill 4 where it is and snap again to finish.", asks: [4], next: "flip" });
  });
  it("a blank pill unlike the others is the odd one out: yellow, and the only pill we ask about", () => {
    const pills = annotatePills(bottle(10, (p) => (p.number === 7 ? blank(7, look(7, { aspect: 1.0, relativeArea: 0.62 })) : p)));
    expect(pills[6]).toMatchObject({ odd: "a different shape and size" });
    expect(pills[6].faceDown).toBeUndefined();
    expect(decideBottle(pills)).toMatchObject({ verdict: "WARNING", title: "Pill 7 looks different from the others.", instruction: "Flip just that one and snap again.", asks: [7] });
  });
  it("an odd pill is never green, even when its imprint matches", () => {
    const d = decideBottle(annotatePills(bottle(10, (p) => (p.number === 2 ? { ...p, features: look(2, { lab: [70, 20, 40] }) } : p))));
    expect(d.verdict).toBe("WARNING");
    expect(d.instruction).toContain("Its imprint matches your label");
    expect(d.instruction).toContain("pharmacist");
  });
  it("a blank pill is not face-down when the label medicine has no imprint at all", () => {
    const pills = bottle(4, (p) => { const q = p.number === 2 ? blank(2) : p; q.result.labelProduct = { ...q.result.labelProduct!, imprintRaw: "" }; return q; });
    const d = decideBottle(annotatePills(pills));
    expect(annotatePills(pills)[1].faceDown).toBeUndefined();
    expect(d).toMatchObject({ verdict: "UNSURE", title: "3 pills match. Pill 2 couldn't be read.", asks: [2] });
  });
  it(`never asks for more than ${MAX_FLIP_ASKS} flips; past that, pour again`, () => {
    const d = decideBottle(annotatePills(bottle(10, (p) => (p.number <= 4 ? blank(p.number) : p))));
    expect(d.asks).toEqual([]); expect(d.next).toBe("pour_again");
    expect(d.instruction).toBe("Give the pills a gentle shake, pour them out again, and snap again.");
    expect(d.verdict).not.toBe("MATCH");
  });
  it("touching or cut-off pills are circled, checked pills stay visible, and the bottle is never green", () => {
    const pills = annotatePills(bottle(8));
    const touching = decideBottle(pills, [{ kind: "touching", box: { x: .4, y: .4, width: .2, height: .1 } }]);
    expect(touching).toMatchObject({ verdict: "UNSURE", matched: 8, title: "8 pills match. Some pills weren't checked.", instruction: "Some pills are touching. Nudge the circled ones apart and snap again.", next: "nudge" });
    expect(decideBottle(pills, [{ kind: "cutoff", box: { x: 0, y: .4, width: .1, height: .1 } }]).instruction).toContain("cut off at the edge");
    expect(decideBottle([], [{ kind: "touching", box: { x: .4, y: .4, width: .2, height: .1 } }])).toMatchObject({ verdict: "UNSURE", title: "We couldn't check any pills yet." });
    const both = decideBottle(annotatePills(bottle(8, (p) => (p.number === 3 ? blank(3) : p))), [{ kind: "touching", box: { x: .4, y: .4, width: .2, height: .1 } }]);
    expect(both).toMatchObject({ next: "flip_and_nudge", asks: [3], instruction: "Flip pill 3 where it is, nudge the circled pills apart, and snap again." });
  });
  it("a mismatch stays red whatever else is going on", () => {
    const pills = annotatePills(bottle(10, (p) => (p.number === 5 ? { ...pill(5, "MISMATCH"), features: look(5, { relativeArea: 0.8, lab: [92, -1.8, 28] }) } : p.number === 2 ? blank(2) : p)));
    expect(decideBottle(pills, [{ kind: "touching", box: { x: .4, y: .4, width: .2, height: .1 } }])).toMatchObject({ verdict: "MISMATCH", title: "Pill 5 doesn't match your label." });
  });
});

it("unknown/low-confidence appearance or a carried match cannot confirm a bottle", () => {
  const p = pill(1); p.result.pill = { ...p.result.pill, imprintConfidence: .9, colors: [], shape: "unknown", colorConfidence: .1, shapeConfidence: .1 };
  expect(decideBottle([p]).verdict).not.toBe("MATCH");
  expect(annotatePills([p])[0].result.verdict).toBe("UNSURE");
  expect(decideBottle([{ ...pill(1), carried: true }]).verdict).not.toBe("MATCH");
});

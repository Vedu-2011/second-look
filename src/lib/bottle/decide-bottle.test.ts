import { describe, expect, it } from "vitest";
import { SAMPLE_RESULTS } from "@/lib/sample-results";
import { appearanceWarning, decideBottle } from "./decide-bottle";
import type { BottlePill } from "./types";
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
    expect(result.verdict).toBe("MATCH"); expect(result.title).toContain("2 detected pills"); expect(result.instruction).toContain("every pill");
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

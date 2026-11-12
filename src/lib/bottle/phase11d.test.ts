// Phase 11d: which prints count as "one letter off" the label's own imprint.
import { describe, expect, it } from "vitest";
import { SAMPLE_RESULTS } from "@/lib/sample-results";
import { editDistance, nearMissSide, spacedImprint } from "./double-read";

const reading = (...imprintSides: string[]) => ({ ...SAMPLE_RESULTS[0].result.pill, imprintSides });
describe("near-miss prints", () => {
  it.each(["TB 200", "JB 200", "IB 260", "ID 200", "ib-200x", "IB 20"])("%s is one character from IB200", (s) => expect(nearMissSide(reading(s), "IB200")).toBe(s));
  it.each(["TYLENOL 500", "93", "2263", "IB 200", "XQ 77", ""])("%s is not a near miss", (s) => expect(nearMissSide(reading(s), "IB200")).toBeNull());
  it("checks each side of a two-sided imprint, and an exact side means it's not a misread", () => {
    expect(nearMissSide(reading("G 13"), "G;12")).toBe("G 13");
    expect(nearMissSide(reading("C 12"), "G;12")).toBe("C 12");
    expect(nearMissSide(reading("93"), "G;12")).toBeNull();
    expect(nearMissSide(reading("12", "93"), "G;12")).toBeNull();
  });
  it("edit distance and spoken spacing", () => {
    expect(editDistance("TB200", "IB200")).toBe(1); expect(editDistance("IB20", "IB200")).toBe(1); expect(editDistance("93", "G12")).toBe(3);
    expect(spacedImprint("IB200")).toBe("IB 200"); expect(spacedImprint("G;12")).toBe("G 12");
  });
});

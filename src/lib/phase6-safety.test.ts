import { describe, expect, it } from "vitest";
import { compareImprint } from "./match/imprint";
import { decide, type PillReading } from "./verdict-engine";
import { mergePillViews } from "./pill-views";
import { RECORDED } from "./fda/recorded";
import cohort from "../../research/out/holdout-cohort.json";
import cache from "../../research/out/holdout-readings.json";

const p = RECORDED.perrigoI2Oval!;
const reading = (text: string): PillReading => ({ imprintSides: [text], imprintConfidence: .95, colors: ["orange"], colorConfidence: .9, shape: "oval", shapeConfidence: .9 });
describe("phase 6 imprint specificity", () => {
  it("reproduces the actual holdout wrong pass, now UNSURE", () => {
    const image = cohort.images.find(i => i.file === "research/data/holdout-68180051303-1.jpg")!;
    const first = cache[("pill-v2:" + image.sha256) as keyof typeof cache].reading;
    const expected = cohort.products["23155012401"];
    expect(first.imprintSides).toEqual(["5"]);
    const r = decide({ndc: "23155012401"}, first, {labelProduct: expected.product, sameDrugProducts: expected.products});
    expect(r.verdict).toBe("UNSURE");
    expect(r.features.find(f => f.name === "Imprint")?.result).toBe("unsure");
    expect(r.reasons.join(" ")).toContain("exact imprint");
  });
  it.each([["598;S", "5"], ["S", "5"], ["I", "1"], ["S5", "55"], ["S;S;5", "S;5;5"], ["L484;200", "1484"], ["I2;44", "12"]])("does not pass folded short/partial %s vs %s", (fda, text) => {
    expect(compareImprint(fda, text).requiresExact).toBe(true);
    const product = {...p, imprintRaw: fda};
    expect(decide({}, reading(text), {labelProduct: product, sameDrugProducts: [product]}).verdict).toBe("UNSURE");
    expect(decide({}, reading(text), {sameDrugProducts: [product]}).verdict).toBe("UNSURE");
  });
  it.each([["I2", "12"], ["L484", "1484"], ["598;S", "S"], ["S", "S"], ["44;291", "44"]])("retains permitted full folding or exact sides %s vs %s", (fda, text) => {
    const product = {...p, imprintRaw: fda};
    expect(decide({}, reading(text), {labelProduct: product, sameDrugProducts: [product]}).verdict).toBe("MATCH");
  });
  it("does not let an unsafe alternative hide an exact alternative", () => {
    const unsafe = {...p, productCode: "unsafe", imprintRaw: "598;S"};
    const exact = {...p, productCode: "exact", imprintRaw: "5"};
    expect(decide({}, reading("5"), {sameDrugProducts: [unsafe, exact]}).verdict).toBe("MATCH");
  });
});
describe("two-view appearance agreement", () => {
  it.each([["white", "off-white"], ["brown", "orange"], ["blue", "purple"]])("accepts close colors %s and %s", (a, b) => {
    expect(mergePillViews([{...reading("I2"), colors:[a]}, {...reading("I2"), colors:[b]}]).viewConflict).toBeUndefined();
  });
  it("passes an orange/brown pair against the same FDA orange pill", () => {
    expect(decide({}, [reading("I2"), {...reading("I2"), colors:["brown"], shape:"capsule"}], {labelProduct:p, sameDrugProducts:[p]}).verdict).toBe("MATCH");
  });
  it("keeps unknown appearance uncertain without calling it a conflict", () => {
    expect(mergePillViews([reading("I2"), {...reading("I2"), colors:[]}]).viewConflict).toContain("could not clearly read");
  });
});

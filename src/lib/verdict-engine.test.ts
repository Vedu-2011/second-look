import { describe, expect, it } from "vitest";
import { SCENARIOS } from "@/lib/fda/__fixtures__/tablet-scenarios";
import { CONCEPTS, RECORDED } from "@/lib/fda/recorded";
import type { Product } from "@/lib/fda/types";
import { decide, mostCommonLook, type EngineData, type PillReading } from "@/lib/verdict-engine";

const [matchS, makerS, mismatchS] = SCENARIOS;
const ibuprofen = RECORDED.ibuprofen200Products;

const perrigoData: EngineData = { labelProduct: RECORDED.perrigoI2Oval, labelDrug: CONCEPTS.ibuprofen200, sameDrugProducts: ibuprofen };
const advilData: EngineData = { labelProduct: RECORDED.advilOval, labelDrug: CONCEPTS.ibuprofen200, sameDrugProducts: ibuprofen };
const noNdcData: EngineData = {
  labelDrug: CONCEPTS.ibuprofen200,
  sameDrugProducts: ibuprofen,
  guessProducts: RECORDED.acetaminophen500Products,
};

const pill = (over: Partial<PillReading> = {}): PillReading => ({ ...matchS.pill, ...over });
const feature = (r: ReturnType<typeof decide>, name: string) => r.features.find((f) => f.name === name)!;

describe("the three demo bottles (recorded FDA data)", () => {
  it("I2 orange oval with the Perrigo NDC is a MATCH", () => {
    const r = decide(matchS.label, matchS.pill, perrigoData);
    expect(r.verdict).toBe("MATCH");
    expect(r.matchedProduct?.ndc9).toBe("0113-0517");
    expect(r.evidence.map((e) => e.role)).toContain("label");
  });

  it("I2 pill with an Advil label is the same medicine from a different maker", () => {
    const r = decide(makerS.label, makerS.pill, advilData);
    expect(r.verdict).toBe("SAME_MEDICINE_DIFFERENT_MAKER");
    expect(r.matchedProduct?.imprintTokens).toEqual(["I2"]);
    expect(r.matchedProduct?.active).toBe(true);
    expect(r.reasons.join(" ")).toContain("Advil (ibuprofen 200 mg) sold by Haleon");
    expect(r.evidence.some((e) => e.source === "NLM RxNorm" && e.rxcui === "310965")).toBe(true);
  });

  it("L484 white oval on an ibuprofen label is a MISMATCH identified as acetaminophen 500 mg", () => {
    const r = decide(mismatchS.label, mismatchS.pill, noNdcData);
    expect(r.verdict).toBe("MISMATCH");
    expect(r.identifiedAs?.title).toBe("Acetaminophen 500 mg");
    expect(r.identifiedAs?.imprintTokens).toContain("L484");
    expect(r.identifiedAs?.active).toBe(true);
    expect(feature(r, "Imprint").result).toBe("mismatch");
    expect(r.highlight).toBe("imprint");
    expect(r.evidence.map((e) => e.role)).toContain("identified");
  });
});

describe("verdict rules", () => {
  it('a "12" reading still matches I2 (look-alike characters)', () => {
    const r = decide(matchS.label, pill({ imprintSides: ["12"] }), perrigoData);
    expect(r.verdict).toBe("MATCH");
    expect(r.reasons[0]).toContain("look alike");
  });

  it("low imprint confidence is UNSURE, never a verdict", () => {
    expect(decide(matchS.label, pill({ imprintConfidence: 0.4 }), perrigoData).verdict).toBe("UNSURE");
    expect(decide(mismatchS.label, { ...mismatchS.pill, imprintConfidence: 0.4 }, noNdcData).verdict).toBe("UNSURE");
  });

  it("right letters but wrong color is UNSURE and says why", () => {
    const r = decide(matchS.label, pill({ colors: ["white"] }), perrigoData);
    expect(r.verdict).toBe("UNSURE");
    expect(r.reasons.join(" ")).toMatch(/color doesn't/);
    expect(feature(r, "Color").result).toBe("mismatch");
    expect(r.highlight).toBe("color");
  });

  it("right letters but wrong shape is UNSURE", () => {
    const r = decide(matchS.label, pill({ shape: "triangle" }), perrigoData);
    expect(r.verdict).toBe("UNSURE");
    expect(r.reasons.join(" ")).toMatch(/shape doesn't/);
  });

  it("letters alone never give a yes: no FDA color on record is UNSURE", () => {
    const noColor = { ...RECORDED.perrigoI2Oval, colorCodes: [] };
    const r = decide(matchS.label, matchS.pill, { ...perrigoData, labelProduct: noColor, sameDrugProducts: [noColor] });
    expect(r.verdict).toBe("UNSURE");
    expect(r.reasons.join(" ")).toMatch(/FDA record doesn't list the color/);
  });

  it("a color word we can't read (but were confident in) is UNSURE, not a match", () => {
    const r = decide(matchS.label, pill({ colors: ["sparkly"] }), perrigoData);
    expect(r.verdict).toBe("UNSURE");
    expect(r.reasons.join(" ")).toMatch(/couldn't tell the pill's color/);
  });

  it("a low-confidence color is not held against the pill", () => {
    expect(decide(matchS.label, pill({ colors: ["white"], colorConfidence: 0.3 }), perrigoData).verdict).toBe("MATCH");
  });

  it("no letters on the pill is UNSURE and asks for the other side", () => {
    const r = decide(matchS.label, pill({ imprintSides: [] }), perrigoData);
    expect(r.verdict).toBe("UNSURE");
    expect(r.reasons[0]).toMatch(/other side/);
  });

  it("a label we can't find is UNSURE", () => {
    const r = decide({ drugName: "Notarealdrug" }, matchS.pill, { sameDrugProducts: [] });
    expect(r.verdict).toBe("UNSURE");
    expect(r.reasons[0]).toMatch(/couldn't find/);
  });

  it("size is never pass or fail", () => {
    for (const s of SCENARIOS) {
      const data = s.id === "match" ? perrigoData : s.id === "different-maker" ? advilData : noNdcData;
      const size = feature(decide(s.label, s.pill, data), "Size");
      expect(size.result).toBe("not_measured");
      expect(size.found).toBe("Not measured");
    }
  });

  it("without an NDC, compares against the most common look and says how many products", () => {
    const r = decide({ drugName: "Ibuprofen", strength: "200 mg" }, matchS.pill, { ...noNdcData, guessProducts: [] });
    expect(r.verdict).toBe("MATCH");
    expect(r.expectedIsTypical).toBe(true);
    expect(r.reasons[0]).toContain(`all ${ibuprofen.length} versions`);
  });

  it("prefers a product that's still made, but still matches one that isn't", () => {
    const r = decide(makerS.label, makerS.pill, advilData);
    expect(r.matchedProduct?.active).toBe(true);
    const onlyOld: Product = { ...ibuprofen.find((p) => !p.active && p.imprintRaw === "I2")!, shapeCode: "C48345" };
    const old = decide(makerS.label, makerS.pill, { ...advilData, sameDrugProducts: [RECORDED.advilOval, onlyOld] });
    expect(old.verdict).toBe("SAME_MEDICINE_DIFFERENT_MAKER");
    expect(old.reasons.join(" ")).toMatch(/no longer marketed/);
  });

  it("a mismatch without a guess still says MISMATCH but doesn't name the pill", () => {
    const r = decide(mismatchS.label, { ...mismatchS.pill, guess: null }, { ...noNdcData, guessProducts: undefined });
    expect(r.verdict).toBe("MISMATCH");
    expect(r.identifiedAs).toBeNull();
    expect(r.reasons.join(" ")).toMatch(/couldn't confirm what this pill is/);
  });

  it("names a pill only from an exact imprint, never a look-alike", () => {
    const r = decide(mismatchS.label, { ...mismatchS.pill, imprintSides: ["1484"] }, noNdcData);
    expect(r.verdict).toBe("MISMATCH");
    expect(r.identifiedAs).toBeNull();
  });

  it("an NDC that could be two products is said out loud and falls back to the drug name", () => {
    const r = decide({ ndc: "0573016017", drugName: "Ibuprofen" }, matchS.pill, { ...noNdcData, labelNdcAmbiguous: true });
    expect(r.reasons[0]).toMatch(/more than one product/);
    expect(r.verdict).toBe("MATCH");
  });

  it("an NDC we couldn't find is said out loud and falls back to the drug name", () => {
    const r = decide({ ndc: "9999-9999", drugName: "Ibuprofen" }, matchS.pill, { ...noNdcData, labelNdcNotFound: true });
    expect(r.reasons[0]).toMatch(/couldn't find NDC 9999-9999/);
    expect(r.verdict).toBe("MATCH");
  });
});

describe("mostCommonLook", () => {
  it("finds the orange oval I2 as the usual ibuprofen 200 mg", () => {
    const look = mostCommonLook(ibuprofen)!;
    expect(look.product.imprintTokens).toEqual(["I2"]);
    expect(look.count).toBeGreaterThan(10);
    expect(mostCommonLook([])).toBeNull();
  });
});

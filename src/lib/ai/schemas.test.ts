import { describe, expect, it } from "vitest";
import { labelReadingSchema, pillReadingSchema, toLabelReading, toPillReading } from "@/lib/ai/schemas";

describe("AI reading schemas", () => {
  it("maps strict label fields to the engine shape", () => {
    const label = labelReadingSchema.parse({ drugName: "Ibuprofen", strength: "200 mg", dosageForm: "tablet", ndc: "0573-0160", pharmacyName: "Maple Street Pharmacy", directions: "Take as directed", isPrescriptionLabel: true, confidence: { drugName: .99, strength: .98, ndc: .95, dosageForm: .9 } });
    expect(toLabelReading(label)).toMatchObject({ drugName: "Ibuprofen", form: "tablet", ndc: "0573-0160" });
  });

  it("rejects invalid confidence and pill colors", () => {
    expect(() => labelReadingSchema.parse({ drugName: null, strength: null, dosageForm: null, ndc: null, pharmacyName: null, directions: null, isPrescriptionLabel: true, confidence: { drugName: 2, strength: 0, ndc: 0, dosageForm: 0 } })).toThrow();
    expect(() => pillReadingSchema.parse({ imprintSides: ["I2"], imprintConfidence: .9, colors: ["silver"], colorConfidence: .9, shape: "oval", shapeConfidence: .9, form: "tablet", pillVisible: true, multiplePills: false, photoProblems: [], scored: false, guess: null })).toThrow();
  });

  it("keeps a separate guess and photo signals", () => {
    const pill = pillReadingSchema.parse({ imprintSides: ["L484"], imprintConfidence: .9, colors: ["white"], colorConfidence: .9, shape: "oval", shapeConfidence: .8, form: "tablet", pillVisible: true, multiplePills: false, photoProblems: [], scored: false, guess: { drugName: "Acetaminophen", strength: "500 mg" } });
    expect(toPillReading(pill)).toMatchObject({ guess: { drugName: "Acetaminophen" }, pillVisible: true });
  });
});

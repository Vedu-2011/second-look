import { describe, expect, it } from "vitest";
import { EMPTY_TYPED, typedRequest } from "./typed-check";
import { verifyInputSchema } from "./verify-schema";
import { recordedLead } from "./recorded-lead";

describe("public typed check", () => {
  it("sends the NDC instead of stale name fields", () => {
    const request = typedRequest({ ...EMPTY_TYPED, ndc: " 0113-0517 ", drugName: "Wrong", side1: " I2 ", colors: ["orange"], shape: "oval" });
    expect(request.label).toEqual({ ndc: "0113-0517", form: "tablet" }); expect(request.pill.imprintSides).toEqual(["I2"]); expect(verifyInputSchema.safeParse(request).success).toBe(true);
  });
  it("sends the medicine name without a stale NDC", () => {
    expect(typedRequest({ ...EMPTY_TYPED, mode: "name", ndc: "0113-0517", drugName: "Ibuprofen", strength: "200 mg" }).label).toEqual({ drugName: "Ibuprofen", strength: "200 mg", form: "tablet" });
  });
  it("retains uncertainty instead of treating unreadable letters as certain", () => {
    const request = typedRequest({ ...EMPTY_TYPED, uncertain: true });
    expect(request.pill.imprintConfidence).toBe(0.4); expect(request.pill.colorConfidence).toBe(0); expect(request.pill.shapeConfidence).toBe(0);
  });
  it("gets an acetaminophen lead from an exact recorded FDA imprint", () => {
    const pill = typedRequest({ ...EMPTY_TYPED, side1: "L484" }).pill;
    expect(recordedLead(pill)?.drugName.toLowerCase()).toContain("acetaminophen");
    expect(recordedLead({ ...pill, imprintSides: ["1484"] })).toBeNull();
    expect(recordedLead({ ...pill, imprintConfidence: 0.4 })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { SCENARIOS } from "@/lib/demo-scenarios";
import { firstProblem, verifyInputSchema } from "@/lib/verify-schema";

const ok = { label: SCENARIOS[0].label, pill: SCENARIOS[0].pill };
const problem = (input: unknown) => {
  const r = verifyInputSchema.safeParse(input);
  return r.success ? null : firstProblem(r.error);
};

describe("verifyInputSchema", () => {
  it("accepts every demo scenario", () => {
    for (const s of SCENARIOS) expect(problem({ label: s.label, pill: s.pill }), s.id).toBeNull();
  });

  it("needs an NDC or a medicine name", () => {
    expect(problem({ ...ok, label: {} })).toBe("Add the NDC or the medicine name from the label.");
  });

  it("explains a bad NDC in plain words", () => {
    expect(problem({ ...ok, label: { ndc: "garbage" } })).toMatch(/doesn't look right/);
  });

  it("rejects confidences outside 0–1 and points at the field", () => {
    expect(problem({ ...ok, pill: { ...ok.pill, imprintConfidence: 3 } })).toMatch(/pill\.imprintConfidence/);
  });

  it("allows a missing or null guess", () => {
    expect(problem({ ...ok, pill: { ...ok.pill, guess: null } })).toBeNull();
  });
});

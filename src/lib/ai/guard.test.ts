import { describe, expect, it } from "vitest";
import { guardExplanation, templateExplanation } from "@/lib/ai/guard";
import { SAMPLE_RESULTS } from "@/lib/sample-results";

const result = SAMPLE_RESULTS[0].result;

describe("explanation guard", () => {
  it("keeps a concise explanation grounded in facts", () => {
    const value = guardExplanation({ summary: "The visible pill matches the FDA record.", pharmacyScript: "The pill matches the FDA record for my label." }, result);
    expect(value.summary).toContain("matches");
  });

  it("falls back when the model invents a medicine", () => {
    expect(guardExplanation({ summary: "This is Tylenol 650 mg.", pharmacyScript: "Ask about Tylenol." }, result)).toEqual(templateExplanation(result));
    expect(guardExplanation({ summary: "this may be tylenol", pharmacyScript: "ask the pharmacy" }, result)).toEqual(templateExplanation(result));
  });

  it("falls back on dosing or medical advice", () => {
    expect(guardExplanation({ summary: "Take this tablet twice daily.", pharmacyScript: "This is safe to take." }, result)).toEqual(templateExplanation(result));
  });
});

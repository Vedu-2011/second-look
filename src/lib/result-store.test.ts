import { describe, expect, it } from "vitest";
import { clearResultMemoryForTests, getResult, saveResult } from "@/lib/result-store";
import { SAMPLE_RESULTS } from "@/lib/sample-results";

describe("result store", () => {
  it("round trips a result through the seven-day store", async () => {
    clearResultMemoryForTests();
    const source = SAMPLE_RESULTS[0].result;
    const id = await saveResult({ result: source, explanation: { summary: "summary", pharmacyScript: "script" } });
    const stored = await getResult(id);
    expect(stored?.result.verdict).toBe(source.verdict);
    expect(stored?.createdAt).toBeTruthy();
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/rate-limit", () => ({
  consumeCheckLimit: async () => ({ allowed: true, count: 1 }),
}));
vi.mock("@/lib/ai/client", () => ({
  AiUnavailableError: class AiUnavailableError extends Error {},
}));
vi.mock("@/lib/ai/readers", () => ({
  readLabel: async () => ({
    drugName: "Ibuprofen",
    strength: "200 mg",
    form: "tablet",
    ndc: "0113-0517",
    isPrescriptionLabel: true,
    confidence: { drugName: 1, strength: 1, ndc: 1, form: 1 },
  }),
  readPill: async () => ({
    imprintSides: ["I2"],
    imprintConfidence: 1,
    colors: ["orange"],
    colorConfidence: 1,
    shape: "oval",
    shapeConfidence: 1,
    form: "tablet",
    pillVisible: true,
    multiplePills: false,
    photoProblems: [],
    guess: null,
  }),
}));
vi.mock("@/lib/check-service", () => ({
  runCheck: async () => ({
    verdict: "MATCH",
    timings: { label: 1, drug: 1, guess: 0, dailymed: 1, total: 3 },
    evidence: [],
    features: [],
    reasons: [],
    expected: null,
    expectedIsTypical: false,
    matchedProduct: null,
    identifiedAs: null,
    labelTitle: "Ibuprofen 200 mg",
    productsCompared: 1,
    label: {},
    pill: {},
    labelProduct: null,
    labels: {},
    checkedAt: new Date().toISOString(),
  }),
}));
vi.mock("@/lib/ai/explain", () => ({
  explain: async () => ({
    summary: "It matches.",
    pharmacyScript: "It matches my label.",
  }),
}));
vi.mock("@/lib/result-store", () => ({
  saveResult: async () => "test-result",
}));
vi.mock("@/lib/flip-store", () => ({
  getFlip: vi.fn(async () => null),
  saveFlip: async () => "11111111-1111-4111-8111-111111111111",
}));

const png =
  "data:image/png;base64," +
  Buffer.from(
    "small image bytes that are long enough to pass the shape check",
  ).toString("base64");

describe("POST /api/check", () => {
  it("rejects an expired continuation without starting a stream", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/check", {
        method: "POST",
        body: JSON.stringify({
          continuationId: "11111111-1111-4111-8111-111111111111",
          skipFlip: true,
        }),
      }),
    );
    expect(response.status).toBe(410);
    expect((await response.json()).error).toContain("expired");
  });
  it("completes a server-owned continuation when skipped", async () => {
    const { getFlip } = await import("@/lib/flip-store");
    const { SAMPLE_RESULTS } = await import("@/lib/sample-results");
    vi.mocked(getFlip).mockResolvedValueOnce(SAMPLE_RESULTS[0].result);
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/check", {
        method: "POST",
        body: JSON.stringify({
          continuationId: "11111111-1111-4111-8111-111111111111",
          skipFlip: true,
        }),
      }),
    );
    const events = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(events.at(-1).type).toBe("result");
    expect(events.some((e) => e.type === "reading")).toBe(false);
  });
  it("streams the four real progress steps in order and ends with a result", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/check", {
        method: "POST",
        body: JSON.stringify({
          labelImage: { dataUrl: png },
          pillImage: { dataUrl: png },
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    const text = await response.text();
    const events = text
      .trim()
      .split("\n")
      .map((item) => JSON.parse(item));
    expect(
      events
        .filter((e) => e.type === "step")
        .map((e) => `${e.step}:${e.state}`),
    ).toEqual([
      "0:working",
      "1:working",
      "0:done",
      "1:done",
      "2:working",
      "2:done",
      "3:working",
      "3:done",
    ]);
    expect(events.at(-1).type).toBe("result");
  });
});

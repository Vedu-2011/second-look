import { describe, it, expect } from "vitest";
import { loadHoldout } from "./research-holdout-results";
import { safetyMetrics } from "./research-safety";
import { checkRequestSchema } from "./check-input";
const pair = {
  image: "test",
  ownNdc: "a",
  labelNdc: "b",
  difficulty: "hard" as const,
};
const m = safetyMetrics([
  { ...pair, wrong: false, verdict: "MATCH" },
  { ...pair, wrong: true, verdict: "MISMATCH" },
  { ...pair, wrong: false, verdict: "UNSURE" },
  { ...pair, wrong: true, verdict: "UNSURE" },
]);
const raw = {
  version: 2,
  date: "2026-11-10T00:00:00Z",
  frozenCommit: "a".repeat(40),
  seed: 1,
  images: 2,
  products: 1,
  pairs: 4,
  hardPairs: 2,
  productOverlap: 0,
  model: "claude-sonnet-5-5",
  promptVersion: "pill-v2",
  totalUsd: 1,
  readerErrors: 0,
  meanReadMs: 1,
  meanBaselineMs: 1,
  metrics: Object.fromEntries(
    ["Sonnet, one view", "Sonnet, two views", "Direct Sonnet"].map((k) => [
      k,
      m,
    ]),
  ),
};
describe("holdout integrity", () => {
  it("accepts coherent safety counts", () =>
    expect(loadHoldout(raw)).not.toBeNull());
  it.each([
    null,
    {},
    { ...raw, productOverlap: 1 },
    { ...raw, totalUsd: 5.1 },
    { ...raw, pairs: 3 },
    { ...raw, hardPairs: 1 },
    { ...raw, frozenCommit: "unfrozen" },
  ])("rejects incomplete/leaked/over-budget results", (value) =>
    expect(loadHoldout(value)).toBeNull(),
  );
  it("rejects a flattering accuracy with the wrong denominator", () =>
    expect(
      loadHoldout({
        ...raw,
        metrics: {
          ...raw.metrics,
          "Sonnet, one view": { ...m, decisiveAccuracy: 0.99 },
        },
      }),
    ).toBeNull());
});
describe("server-owned flip continuation input", () => {
  const id = "11111111-1111-4111-8111-111111111111",
    photo = { dataUrl: "data:image/png;base64," + "a".repeat(40) };
  it("accepts one optional second image or a skip", () => {
    expect(
      checkRequestSchema.safeParse({
        continuationId: id,
        otherSideImage: photo,
      }).success,
    ).toBe(true);
    expect(
      checkRequestSchema.safeParse({ continuationId: id, skipFlip: true })
        .success,
    ).toBe(true);
  });
  it("rejects both, neither, invalid IDs, and client-only readings", () => {
    for (const v of [
      { continuationId: id },
      { continuationId: id, skipFlip: true, otherSideImage: photo },
      { continuationId: "x", skipFlip: true },
      { label: { drugName: "X" }, pill: { imprintSides: ["I2"] } },
    ])
      expect(checkRequestSchema.safeParse(v).success).toBe(false);
  });
});

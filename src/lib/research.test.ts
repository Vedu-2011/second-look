import { describe, it, expect } from "vitest";
import {
  buildPairs,
  shuffled,
  metrics,
  percent,
  type ResearchImage,
} from "./research";
import { loadResearch } from "./research-results";
import { RECORDED } from "./fda/recorded";
import { compareImprint } from "./match/imprint";
import { decide } from "./verdict-engine";
import { requestCostBound, canReserve } from "./research-budget";
const base = RECORDED.perrigoI2Oval!;
const images: ResearchImage[] = Array.from({ length: 8 }, (_, i) => ({
  file: `image-${i}`,
  url: `https://example.invalid/${i}`,
  ndc: `${i}`,
  generic: `drug-${i}`,
  product: {
    ...base,
    productCode: `p${i}`,
    imprintRaw: `X${i}`,
    shapeCode: i < 6 ? "C48345" : "C48348",
    colorCodes: ["C48325"],
  },
}));
describe("research protocol", () => {
  it("reserves maximum input/output and all reader attempts", () => {
    expect(requestCostBound("claude-sonnet-5-5", 2000, 1200, 2)).toBe(
      requestCostBound("claude-sonnet-5-5", 2000, 1200) * 2,
    );
    expect(requestCostBound("claude-sonnet-5-5", 20000, 1200)).toBeGreaterThan(
      requestCostBound("claude-sonnet-5-5", 2000, 1200),
    );
    expect(() => requestCostBound("unknown", 2000, 1200)).toThrow();
  });
  it("accounts for already in-flight spend before accepting a request", () => {
    expect(canReserve(7.8, 0.15, 0.1)).toBe(false);
    expect(canReserve(7.8, 0, 0.1)).toBe(true);
  });
  it("uses a reproducible seeded shuffle without mutating input", () => {
    expect(shuffled(images, 2)).toEqual(shuffled(images, 2));
    expect(shuffled(images, 2)).not.toEqual(shuffled(images, 3));
    expect(images[0].file).toBe("image-0");
  });
  it("balances truth per image and uses different medicine negatives", () => {
    const pairs = buildPairs(images);
    expect(pairs).toHaveLength(16);
    expect(pairs.filter((p) => p.wrong)).toHaveLength(8);
    for (const p of pairs) {
      expect(p.wrong ? p.labelNdc !== p.ownNdc : p.labelNdc === p.ownNdc).toBe(
        true,
      );
    }
    expect(
      pairs.filter((p) => p.difficulty === "hard").length,
    ).toBeGreaterThanOrEqual(4);
    expect(buildPairs(images)).toEqual(pairs);
  });
  it("refuses an invalid negative pool", () =>
    expect(() => buildPairs([images[0]])).toThrow());
  it("does not label a side-order equivalent imprint as a different imprint", () => {
    const same = [
      { ...images[0], product: { ...images[0].product, imprintRaw: "44;291" } },
      { ...images[1], product: { ...images[1].product, imprintRaw: "291;44" } },
    ];
    expect(() => buildPairs(same)).toThrow();
  });
  it("counts abstentions separately from catches and false alarms", () => {
    const pairs = buildPairs(images.slice(0, 2));
    const m = metrics(
      pairs.map((p, i) => ({
        ...p,
        verdict:
          i === 1
            ? ("MISMATCH" as const)
            : i === 2
              ? ("MATCH" as const)
              : ("UNSURE" as const),
      })),
    );
    expect(m).toMatchObject({
      n: 4,
      caught: 1,
      falseAlarms: 0,
      passed: 1,
      unsure: 2,
      catchRate: 0.5,
      falseAlarmRate: 0,
      passRate: 0.5,
    });
  });
  it("has no fabricated denominator for an empty group and truncates rates", () => {
    expect(metrics([]).catchRate).toBeNull();
    expect(percent(2 / 3)).toBe("66.6%");
  });
  it("rejects missing and malformed results instead of inventing numbers", () => {
    expect(loadResearch(null)).toBeNull();
    expect(loadResearch({ version: 1, images: 200 })).toBeNull();
  });
  it("accepts coherent results and rejects altered rates or totals", () => {
    const pairs = buildPairs(images);
    const m = metrics(
      pairs.map((p) => ({
        ...p,
        verdict: p.wrong ? ("MISMATCH" as const) : ("MATCH" as const),
      })),
    );
    const full = {
      ...m,
      n: 400,
      right: 200,
      wrong: 200,
      caught: 200,
      passed: 200,
      easy: { n: 0, caught: 0, unsure: 0, passed: 0 },
      hard: { n: 200, caught: 200, unsure: 0, passed: 0 },
    };
    const raw = {
      version: 1,
      seed: 1,
      date: "2026-11-10T00:00:00.000Z",
      promptVersion: "pill-v1",
      models: ["s", "h"],
      images: 200,
      products: 100,
      pairs: 400,
      skipped: [],
      totalUsd: 1,
      metrics: Object.fromEntries(
        ["s", "h", "s-no-fold", "h-no-fold", "baseline"].map((k) => [
          k,
          { ...full },
        ]),
      ),
      reading: Object.fromEntries(
        ["s", "h"].map((k) => [
          k,
          {
            exact: 200,
            close: 0,
            wrong: 0,
            noRead: 0,
            colorAgree: 200,
            shapeAgree: 200,
            errors: 0,
          },
        ]),
      ),
      timing: { s: { meanReadMs: 1 }, h: { meanReadMs: 1 } },
      baselineMeanMs: 1,
    };
    expect(loadResearch(raw)).not.toBeNull();
    expect(loadResearch({ ...raw, pairs: 399 })).toBeNull();
    expect(
      loadResearch({
        ...raw,
        metrics: {
          ...raw.metrics,
          s: { ...full, hard: { ...full.hard, unsure: 1 } },
        },
      }),
    ).toBeNull();
    expect(
      loadResearch({
        ...raw,
        metrics: { ...raw.metrics, s: { ...full, catchRate: 0.9 } },
      }),
    ).toBeNull();
  });
  it("turns off only look-alike folding in the ablation", () => {
    expect(compareImprint("I2", "12").result).toBe("close");
    expect(compareImprint("I2", "12", false).result).toBe("none");
    const pill = {
      imprintSides: ["12"],
      imprintConfidence: 1,
      colors: ["orange"],
      colorConfidence: 1,
      shape: "oval",
      shapeConfidence: 1,
    };
    const data = { labelProduct: base, sameDrugProducts: [base] };
    expect(decide({ ndc: base.ndc9 }, pill, data).verdict).toBe("MATCH");
    expect(decide({ ndc: base.ndc9 }, pill, data, false).verdict).toBe(
      "MISMATCH",
    );
  });
});

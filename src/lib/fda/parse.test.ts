import { describe, expect, it } from "vitest";
import labels from "./__fixtures__/dailymed-labels.json";
import { describeConcept, productName } from "./concept";
import { parseDailyMedDate } from "./dailymed-parse";
import { CONCEPTS, RECORDED } from "./recorded";
import { parseNdcProperties } from "./rxnav-parse";

const row = (ndc9: string, props: Record<string, string | string[]>, extra: object = {}) => ({
  ndc9,
  rxcui: "310965",
  propertyConceptList: {
    propertyConcept: Object.entries(props).flatMap(([propName, v]) =>
      (Array.isArray(v) ? v : [v]).map((propValue) => ({ propName, propValue })),
    ),
  },
  ...extra,
});
const list = (...rows: object[]) => ({ ndcPropertyList: { ndcProperty: rows } });

describe("parseNdcProperties", () => {
  it("keeps one product per product code, the richest row", () => {
    const out = parseNdcProperties(
      list(row("0573-0160", { LABELER: "A" }), row("0573-0160", { LABELER: "A", IMPRINT_CODE: "Advil", COLOR: "C48332" })),
    );
    expect(out).toHaveLength(1);
    expect(out[0].imprintRaw).toBe("Advil");
  });

  it("splits packed two-tone colors and repeated COLOR rows", () => {
    expect(parseNdcProperties(list(row("0001-0001", { COLOR: "C48325;C48331" })))[0].colorCodes).toEqual(["C48325", "C48331"]);
    expect(parseNdcProperties(list(row("0001-0001", { COLOR: ["C48325", "C48331"] })))[0].colorCodes).toEqual(["C48325", "C48331"]);
  });

  it('reads SCORE "1" as not scored and 2+ as scored, and size in mm', () => {
    const [a, b] = parseNdcProperties(
      list(row("0001-0001", { SCORE: "1", SIZE: "15 mm" }), row("0001-0002", { SCORE: "2", SIZE: "11mm" })),
    );
    expect([a.scored, b.scored]).toEqual([false, true]);
    expect([a.sizeMm, b.sizeMm]).toEqual([15, 11]);
  });

  it("marks finished products as no longer made, and missing status as active", () => {
    const out = parseNdcProperties(
      list(row("0001-0001", { MARKETING_STATUS: "completed" }), row("0001-0002", { MARKETING_STATUS: "active" }), row("0001-0003", {})),
    );
    expect(out.map((p) => p.active)).toEqual([false, true, true]);
  });

  it("parses the recorded RxNav data for ibuprofen 200 mg", () => {
    const ps = RECORDED.ibuprofen200Products;
    expect(ps.length).toBeGreaterThan(400);
    expect(new Set(ps.map((p) => p.productCode)).size).toBe(ps.length);
    expect(ps.some((p) => !p.active)).toBe(true);
    expect(RECORDED.perrigoI2Oval).toMatchObject({ labeler: "L. Perrigo Company", imprintRaw: "I2", colorCodes: ["C48331"], sizeMm: 15, active: true });
    expect(RECORDED.advilOval).toMatchObject({ brand: "Advil", imprintTokens: ["ADVIL"], colorCodes: ["C48332"] });
  });

  it("ignores rows without an NDC and odd JSON", () => {
    expect(parseNdcProperties(list({ rxcui: "1" }))).toEqual([]);
    expect(parseNdcProperties(null)).toEqual([]);
  });
});

describe("names and dates", () => {
  it("turns RxNorm names into plain titles", () => {
    expect(describeConcept(CONCEPTS.advil200.name)).toEqual({ title: "Ibuprofen 200 mg", brand: "Advil", form: "tablet" });
    expect(describeConcept(CONCEPTS.acetaminophen500.name).title).toBe("Acetaminophen 500 mg");
    expect(productName({ title: "Ibuprofen 200 mg", brand: "Advil" })).toBe("Advil (ibuprofen 200 mg)");
    expect(productName(null)).toBe("your medicine");
  });

  it("reads DailyMed dates", () => {
    expect(parseDailyMedDate("Nov 06, 2026")).toBe("2026-11-06");
    expect(parseDailyMedDate("Sep 3, 2025")).toBe("2025-09-03");
    expect(parseDailyMedDate("yesterday")).toBeNull();
    const perrigo = (labels as Record<string, { published_date: string } | null>)["aebae4b3-18c8-4ecf-b578-1fe7cc50076b"];
    expect(parseDailyMedDate(perrigo?.published_date)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

import { describe, expect, it } from "vitest";
import { COLOR_CODES, SHAPE_CODES } from "./fda/codes";
import { ADVIL_OVAL, IBUPROFEN_I2_OVAL, IBUPROFEN_I2_ROUND, OMEPRAZOLE_CAPSULE } from "./fda/fixtures";
import {
  ASPECT,
  imprintFontSize,
  imprintSides,
  imprintStyle,
  isScored,
  luminance,
  parseSizeMm,
  pillFills,
  pillGeometry,
  shade,
} from "./pill";

describe("pillGeometry", () => {
  it("draws the I2 round tablet as a 10 mm circle", () => {
    const g = pillGeometry(IBUPROFEN_I2_ROUND.shapeCode, IBUPROFEN_I2_ROUND.sizeMm);
    expect(g).toMatchObject({ drawn: "round", width: 10, height: 10, fallback: false });
  });

  it("draws the I2 oval as 15 mm long and shorter than it is wide", () => {
    const g = pillGeometry(IBUPROFEN_I2_OVAL.shapeCode, IBUPROFEN_I2_OVAL.sizeMm);
    expect(g.drawn).toBe("oval");
    expect(g.width).toBe(15);
    expect(g.height).toBeCloseTo(15 * ASPECT.oval);
  });

  it("keeps real pills to scale relative to each other", () => {
    const round = pillGeometry(IBUPROFEN_I2_ROUND.shapeCode, IBUPROFEN_I2_ROUND.sizeMm);
    const advil = pillGeometry(ADVIL_OVAL.shapeCode, ADVIL_OVAL.sizeMm);
    expect(advil.width / round.width).toBeCloseTo(ADVIL_OVAL.sizeMm / IBUPROFEN_I2_ROUND.sizeMm);
    expect(advil.width).toBe(15);
  });

  it("draws capsules as a long stadium", () => {
    const g = pillGeometry(OMEPRAZOLE_CAPSULE.shapeCode, OMEPRAZOLE_CAPSULE.sizeMm);
    expect(g.drawn).toBe("capsule");
    expect(g.height).toBeLessThan(g.width / 2);
  });

  it("has a drawing or a marked fallback for every FDA shape", () => {
    for (const code of Object.keys(SHAPE_CODES)) {
      const g = pillGeometry(code, 12);
      expect(g.path.startsWith("M")).toBe(true);
      expect(g.path).not.toContain("NaN");
      expect(g.width).toBeGreaterThan(0);
      expect(g.height).toBeGreaterThan(0);
    }
    expect(pillGeometry("C48351", 12)).toMatchObject({ shape: "tear", drawn: "round", fallback: true });
    expect(pillGeometry("C48343", 12)).toMatchObject({ shape: "hexagon", drawn: "polygon", fallback: false });
  });

  it("falls back safely for unknown codes and bad sizes", () => {
    expect(pillGeometry("C00000", 12)).toMatchObject({ drawn: "round", fallback: true });
    expect(pillGeometry("C48348", NaN).width).toBe(10);
    expect(pillGeometry("C48348", -3).width).toBe(10);
  });
});

describe("pillFills", () => {
  it("uses our display hex for the FDA color", () => {
    expect(pillFills(["C48331"])).toEqual([COLOR_CODES.C48331.hex]);
  });
  it("returns two fills for a two-tone capsule (packed or as an array)", () => {
    const two = [COLOR_CODES.C48325.hex, COLOR_CODES.C48331.hex];
    expect(pillFills("C48325;C48331")).toEqual(two);
    expect(pillFills(OMEPRAZOLE_CAPSULE.colorCodes)).toEqual(two);
  });
  it("never returns more than two fills, and a neutral gray when unknown", () => {
    expect(pillFills(["C48325", "C48331", "C48330"])).toHaveLength(2);
    expect(pillFills([])).toEqual(["#D9DCE1"]);
    expect(pillFills(["C99999"])).toEqual(["#D9DCE1"]);
  });
});

describe("imprint helpers", () => {
  it("splits sides on semicolons", () => {
    expect(imprintSides("44;291")).toEqual(["44", "291"]);
    expect(imprintSides("I2")).toEqual(["I2"]);
    expect(imprintSides(" G ; 2 ")).toEqual(["G", "2"]);
    expect(imprintSides(undefined)).toEqual([]);
  });

  it("shrinks the font for longer imprints and keeps it inside the pill", () => {
    const g = pillGeometry("C48345", 16);
    const short = imprintFontSize("I2", g);
    const long = imprintFontSize("Advil", g);
    expect(long).toBeLessThan(short);
    expect("Advil".length * long * 0.62).toBeLessThan(g.width);
    expect(short).toBeLessThan(g.height);
  });

  it("prints on capsules and debosses on tablets", () => {
    expect(imprintStyle(pillGeometry("C48336", 14))).toBe("printed");
    expect(imprintStyle(pillGeometry("C48348", 10))).toBe("debossed");
  });
});

describe("small helpers", () => {
  it("reads RxNav SCORE (1 = no score line)", () => {
    expect(isScored(1)).toBe(false);
    expect(isScored("2")).toBe(true);
    expect(isScored(undefined)).toBe(false);
  });

  it("parses RxNav sizes", () => {
    expect(parseSizeMm("10 mm")).toBe(10);
    expect(parseSizeMm("15.5mm")).toBe(15.5);
    expect(parseSizeMm(16)).toBe(16);
    expect(parseSizeMm("")).toBeNull();
    expect(parseSizeMm(undefined)).toBeNull();
  });

  it("shades toward black or white", () => {
    expect(shade("#808080", 1)).toBe("#000000");
    expect(shade("#808080", -1)).toBe("#ffffff");
    expect(shade("#808080", 0)).toBe("#808080");
  });

  it("computes WCAG luminance", () => {
    expect(luminance("#FFFFFF")).toBeCloseTo(1);
    expect(luminance("#000000")).toBeCloseTo(0);
  });
});

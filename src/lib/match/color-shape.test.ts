import { describe, expect, it } from "vitest";
import { colorsFromCodes, compareColors, normalizeColor } from "./color";
import { readingAppearance } from "./reading";
import { compareShapes, normalizeShape, shapeFromCode } from "./shape";

describe("colors", () => {
  it("normalizes everyday words", () => {
    expect(normalizeColor("Light Orange")).toBe("orange");
    expect(normalizeColor("GREY")).toBe("gray");
    expect(normalizeColor("pinkish brown")).toBe("brown");
    expect(normalizeColor("cream")).toBe("off-white");
    expect(normalizeColor("sparkly")).toBeNull();
  });
  it("reads FDA codes, including packed two-tone values", () => {
    expect(colorsFromCodes("C48331")).toEqual(["orange"]);
    expect(colorsFromCodes("C48325;C48331")).toEqual(["white", "orange"]);
  });
  it("compares exact, close and different", () => {
    expect(compareColors(["orange"], ["orange"])).toBe("exact");
    expect(compareColors(["orange"], ["red"])).toBe("close");
    expect(compareColors(["white"], ["off-white"])).toBe("close");
    expect(compareColors(["orange"], ["white"])).toBe("different");
    expect(compareColors([], ["white"])).toBe("unknown");
  });
  it("counts one half of a two-tone pill as close, not different", () => {
    expect(compareColors(["white", "orange"], ["orange"])).toBe("close");
    expect(compareColors(["white", "orange"], ["white", "orange"])).toBe("exact");
    expect(compareColors(["white", "orange"], ["blue"])).toBe("different");
  });
});

describe("shapes", () => {
  it("normalizes synonyms", () => {
    expect(normalizeShape("Caplet")).toBe("oblong");
    expect(normalizeShape("circle")).toBe("round");
    expect(normalizeShape("OVAL")).toBe("oval");
    expect(normalizeShape("blob")).toBeNull();
  });
  it("reads FDA shape codes", () => {
    expect(shapeFromCode("C48345")).toBe("oval");
    expect(shapeFromCode("C48348")).toBe("round");
    expect(shapeFromCode(undefined)).toBeNull();
  });
  it("treats long shapes as close to each other", () => {
    expect(compareShapes("oval", "oval")).toBe("exact");
    expect(compareShapes("oval", "oblong")).toBe("close");
    expect(compareShapes("capsule", "oval")).toBe("close");
    expect(compareShapes("round", "oval")).toBe("different");
    expect(compareShapes(null, "oval")).toBe("unknown");
  });
  it("draws the pill as it was read", () => {
    expect(readingAppearance({ colors: ["orange"], shape: "oval" } as never)).toEqual({ colorCodes: ["C48331"], shapeCode: "C48345" });
  });
});

import { describe, expect, it } from "vitest";
import { COLOR_CODES, SHAPE_CODES, colorFor, colorNames, shapeFor, shapeName, splitCodes } from "./codes";

describe("FDA SPL code tables", () => {
  it("has all 12 FDA colors, C48323 to C48334", () => {
    const codes = Object.keys(COLOR_CODES).sort();
    expect(codes).toHaveLength(12);
    expect(codes).toEqual(Array.from({ length: 12 }, (_, i) => `C${48323 + i}`));
  });

  it("has all 19 FDA shapes, C48335 to C48353", () => {
    const codes = Object.keys(SHAPE_CODES).sort();
    expect(codes).toHaveLength(19);
    expect(codes).toEqual(Array.from({ length: 19 }, (_, i) => `C${48335 + i}`));
  });

  it("maps the codes FDA lists for our demo pills", () => {
    expect(colorFor("C48331")?.color).toBe("orange");
    expect(colorFor("C48332")?.color).toBe("brown");
    expect(colorFor("C48325")?.color).toBe("white");
    expect(shapeFor("C48348")?.shape).toBe("round");
    expect(shapeFor("C48345")?.shape).toBe("oval");
    expect(shapeFor("C48336")?.shape).toBe("capsule");
  });

  it("gives every color a valid display hex", () => {
    for (const c of Object.values(COLOR_CODES)) expect(c.hex).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it("tolerates case and whitespace", () => {
    expect(colorFor(" c48331 ")?.color).toBe("orange");
    expect(shapeFor("c48345")?.shape).toBe("oval");
  });

  it("returns undefined/null for unknown codes", () => {
    expect(colorFor("C99999")).toBeUndefined();
    expect(shapeName("C99999")).toBeNull();
    expect(shapeName(undefined)).toBeNull();
  });
});

describe("splitCodes", () => {
  it("splits RxNav's packed two-tone value", () => {
    expect(splitCodes("C48325;C48331")).toEqual(["C48325", "C48331"]);
  });
  it("accepts arrays, mixed packing and empties", () => {
    expect(splitCodes(["C48325", "c48331; ", ""])).toEqual(["C48325", "C48331"]);
    expect(splitCodes(undefined)).toEqual([]);
    expect(splitCodes("")).toEqual([]);
  });
});

describe("colorNames", () => {
  it("names one or two colors in plain words", () => {
    expect(colorNames(["C48331"])).toBe("Orange");
    expect(colorNames("C48325;C48331")).toBe("White and orange");
  });
  it("skips unknown codes and returns null when nothing is left", () => {
    expect(colorNames(["C99999", "C48330"])).toBe("Yellow");
    expect(colorNames(["C99999"])).toBeNull();
  });
});

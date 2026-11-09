import { describe, expect, it } from "vitest";
import { compareImprint, displayImprint, foldConfusables, tokenizeImprint } from "./imprint";

describe("tokenizeImprint", () => {
  it("joins separators inside a token", () => {
    for (const s of ["I2", "I-2", "i2", "I.2"]) expect(tokenizeImprint(s), s).toEqual(["I2"]);
  });
  it("splits sides on ; and words on spaces", () => {
    expect(tokenizeImprint("44;291")).toEqual(["44", "291"]);
    expect(tokenizeImprint(["M", "30"])).toEqual(["M", "30"]);
  });
  it("drops FDA descriptor words but keeps single letters", () => {
    expect(tokenizeImprint("LOGO;A")).toEqual(["A"]);
    expect(tokenizeImprint("Debossed L484")).toEqual(["L484"]);
  });
});

describe("compareImprint", () => {
  it("matches exactly whatever the punctuation", () => {
    expect(compareImprint("I2", ["I-2"]).result).toBe("exact");
    expect(compareImprint("I2", ["i 2"]).result).toBe("exact");
  });
  it("ignores side order", () => {
    expect(compareImprint("44;291", ["291", "44"]).result).toBe("exact");
    expect(compareImprint("44;291", ["291 44"]).result).toBe("exact");
  });
  it("counts one visible side as a partial exact match", () => {
    expect(compareImprint("44;291", ["291"])).toEqual({ result: "exact", partial: true });
  });
  it("treats look-alike characters as close", () => {
    expect(compareImprint("I2", ["12"]).result).toBe("close");
    expect(compareImprint("L484", ["1484"]).result).toBe("close");
    expect(compareImprint("IBU 200", ["1BU", "2OO"]).result).toBe("close");
  });
  it("says none for different imprints and for blanks", () => {
    expect(compareImprint("I2", ["L484"]).result).toBe("none");
    expect(compareImprint("", ["I2"]).result).toBe("none");
    expect(compareImprint("I2", []).result).toBe("none");
  });
  it("matches a reading split across words to one FDA token", () => {
    expect(compareImprint("ADVIL", ["AD", "VIL"]).result).toBe("exact");
  });
});

describe("helpers", () => {
  it("folds confusable characters", () => {
    expect(foldConfusables("L484")).toBe("I4B4");
    expect(foldConfusables("1484")).toBe("I4B4");
  });
  it("formats sides for display", () => {
    expect(displayImprint("44;291")).toBe("44 / 291");
    expect(displayImprint("LOGO;A")).toBe("A");
  });
  it("never shows descriptor words as markings, even inside a side", () => {
    expect(displayImprint("Advil;asymmetrical;underline")).toBe("Advil");
    expect(displayImprint("LOGO 54 411; Debossed")).toBe("54 411");
    expect(displayImprint("M, 30")).toBe("M 30");
  });
});

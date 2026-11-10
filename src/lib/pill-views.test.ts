import { describe, it, expect } from "vitest";
import { mergePillViews, flipReason } from "./pill-views";
import { decide, type PillReading } from "./verdict-engine";
import { RECORDED } from "./fda/recorded";
import { cleanPillReading } from "./ai/clean-pill";
import { pillReadingSchema } from "./ai/schemas";
import { safetyMetrics } from "./research-safety";
import { normalizeShape } from "./match/shape";
const p = RECORDED.perrigoI2Oval!;
const reading = (text = "I2"): PillReading => ({
  imprintSides: text ? [text] : [],
  imprintConfidence: text ? 1 : 0,
  colors: ["orange"],
  colorConfidence: 1,
  shape: "oval",
  shapeConfidence: 1,
  pillVisible: true,
  multiplePills: false,
  form: "tablet",
  photoProblems: [],
  scored: false,
  guess: null,
});
const data = { labelProduct: p, sameDrugProducts: [p] };
describe("two views of one pill", () => {
  it.each(["capsule", "oval", "round"])(
    "recognizes the descriptive suffix %s-shaped",
    (shape) => expect(normalizeShape(shape + "-shaped")).toBe(shape),
  );
  it("keeps single-view behavior", () =>
    expect(mergePillViews([reading()])).toEqual(reading()));
  it("unions sides and avoids duplicate evidence", () =>
    expect(mergePillViews([reading(), reading()]).imprintSides).toEqual([
      "I2",
    ]));
  it("uses clear text from the other side without assigning confidence to blank text", () =>
    expect(
      decide({ ndc: p.ndc9 }, [reading(""), reading()], data).verdict,
    ).toBe("MATCH"));
  it("does not raise low confidence on a readable fragment", () =>
    expect(
      decide(
        { ndc: p.ndc9 },
        [reading(), { ...reading("2"), imprintConfidence: 0.4 }],
        data,
      ).verdict,
    ).toBe("UNSURE"));
  it.each(["white", "blue"])("rejects different colors: %s", (color) =>
    expect(
      decide({}, [reading(), { ...reading(), colors: [color] }], data).verdict,
    ).toBe("UNSURE"),
  );
  it("rejects different shapes", () =>
    expect(
      decide({}, [reading(), { ...reading(), shape: "round" }], data).verdict,
    ).toBe("UNSURE"));
  it("rejects untrusted appearance on either photo", () =>
    expect(
      decide({}, [reading(), { ...reading(), colorConfidence: 0.3 }], data)
        .verdict,
    ).toBe("UNSURE"));
  it("rejects multiple or absent pills", () => {
    for (const patch of [{ multiplePills: true }, { pillVisible: false }])
      expect(
        decide({}, [reading(), { ...reading(), ...patch }], data).verdict,
      ).toBe("UNSURE");
  });
  it("does not accept a shared side when the other visible side contradicts a hard look-alike", () => {
    const expected = { ...p, imprintRaw: "44;123" };
    expect(
      decide({}, [reading("44"), reading("999")], {
        labelProduct: expected,
        sameDrugProducts: [expected],
      }).verdict,
    ).toBe("MISMATCH");
  });
  it("matches complete two-sided text in either order", () => {
    const expected = { ...p, imprintRaw: "44;123" };
    expect(
      decide({}, [reading("123"), reading("44")], {
        labelProduct: expected,
        sameDrugProducts: [expected],
      }).verdict,
    ).toBe("MATCH");
  });
  it("never passes two blank sides", () =>
    expect(decide({}, [reading(""), reading("")], data).verdict).toBe(
      "UNSURE",
    ));
  it("requests a flip for no/unclear/partial text", () => {
    expect(flipReason(reading(""))).toBeTruthy();
    expect(flipReason({ ...reading(), imprintConfidence: 0.4 })).toBeTruthy();
    expect(
      flipReason(reading("44"), { ...p, imprintRaw: "44;123" }),
    ).toBeTruthy();
    expect(flipReason(reading(), p)).toBeNull();
  });
  it("requires one or two views", () => {
    expect(() => mergePillViews([])).toThrow();
    expect(() => mergePillViews([reading(), reading(), reading()])).toThrow();
  });
});
describe("robust transcription cleanup", () => {
  it("keeps short readable text unchanged", () =>
    expect(
      pillReadingSchema.parse(cleanPillReading(reading())).imprintSides,
    ).toEqual(["I2"]));
  it("bounds long strings without rejecting an otherwise useful reading", () => {
    const clean = pillReadingSchema.parse(
      cleanPillReading({
        ...reading("X".repeat(100)),
        shape: "oval ".repeat(20),
        form: "tablet ".repeat(20),
      }),
    );
    expect(clean.imprintSides[0]).toHaveLength(40);
    expect(clean.imprintConfidence).toBeLessThan(0.7);
    expect(clean.shapeConfidence).toBeLessThan(0.5);
  });
  it.each(["blank", "no visible imprint", "none", "unreadable"])(
    "treats %s as absence, not stamped text",
    (text) =>
      expect(
        pillReadingSchema.parse(cleanPillReading(reading(text))).imprintSides,
      ).toEqual([]),
  );
  it("does not silently turn uncertain letters into a confident match", () =>
    expect(
      pillReadingSchema.parse(cleanPillReading(reading("I2?")))
        .imprintConfidence,
    ).toBeLessThan(0.7));
  it("does not invent confidence or accept malformed types", () =>
    expect(() =>
      pillReadingSchema.parse(cleanPillReading({ imprintSides: 33 })),
    ).toThrow());
  it("lowers confidence when color data is lost", () =>
    expect(
      pillReadingSchema.parse(
        cleanPillReading({ ...reading(), colors: ["mysterious color"] }),
      ).colorConfidence,
    ).toBeLessThan(0.5));
});
it("reports safety and coverage together including wrong passes", () => {
  const pair = {
    image: "x",
    ownNdc: "a",
    labelNdc: "b",
    difficulty: "hard" as const,
  };
  const m = safetyMetrics([
    { ...pair, wrong: true, verdict: "MATCH" },
    { ...pair, wrong: false, verdict: "MATCH" },
    { ...pair, wrong: true, verdict: "UNSURE" },
    { ...pair, wrong: false, verdict: "MISMATCH" },
  ]);
  expect(m).toMatchObject({
    wrongPassed: 1,
    falseAlarms: 1,
    passed: 1,
    decisive: 3,
    correct: 1,
    coverage: 0.75,
    decisiveAccuracy: 1 / 3,
  });
  expect(safetyMetrics([]).decisiveAccuracy).toBeNull();
});

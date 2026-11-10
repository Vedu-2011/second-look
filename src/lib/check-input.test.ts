import { describe, expect, it } from "vitest";
import { earlyExit, parseImageDataUrl } from "@/lib/check-input";

const label = { drugName: "Ibuprofen", isPrescriptionLabel: true, confidence: { drugName: .9, strength: .9, ndc: .9, form: .9 } };
const pill = { imprintSides: ["I2"], imprintConfidence: .9, colors: ["orange"], colorConfidence: .9, shape: "oval", shapeConfidence: .9, form: "tablet", pillVisible: true, multiplePills: false, photoProblems: [] as Array<"blur" | "glare" | "too far" | "imprint side down"> };

describe("check input", () => {
  it("accepts supported image data and rejects other media", () => {
    expect(parseImageDataUrl("data:image/jpeg;base64,aGVsbG8=").mediaType).toBe("image/jpeg");
    expect(() => parseImageDataUrl("data:image/heic;base64,aGVsbG8=")).toThrow(/JPG, PNG/);
  });

  it("returns clear early exits for unsafe photos", () => {
    expect(earlyExit({ ...label, drugName: undefined }, pill)?.code).toBe("not_label");
    expect(earlyExit(label, { ...pill, pillVisible: false })?.code).toBe("no_pill");
    expect(earlyExit(label, { ...pill, multiplePills: true })?.code).toBe("multiple_pills");
    expect(earlyExit(label, { ...pill, photoProblems: ["imprint side down"] })?.code).toBe("imprint_down");
  });
});

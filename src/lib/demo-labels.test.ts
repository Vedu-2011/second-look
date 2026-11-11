import { describe, expect, it } from "vitest";
import { demoLabels } from "./demo-labels";

describe("printable demo labels", () => {
  it("defaults to three fictional labels with the intended product codes", () => {
    const labels = demoLabels();
    expect(labels).toHaveLength(3);
    expect(labels.map(l => l.ndc)).toEqual(["70010-065", "0573-0169", "70010-065"]);
    expect(labels.map(l => `${l.drug} ${l.strength} ${l.form} · ${l.mfr}`)).toEqual(["Metformin 1,000 mg tablet · Granules", "Advil Liqui-Gels (ibuprofen) 200 mg capsule · Haleon", "Metformin 1,000 mg tablet · Granules"]);
    expect(labels.every(l => l.patient === "Alex Rivera")).toBe(true);
  });
  it("supports shared query values and per-bottle overrides", () => {
    const labels = demoLabels({ ndc: "12345-6789", mfr: "Sample maker", "different-maker.ndc": "0573-0160", patient: ["Jamie Example", "ignored"] });
    expect(labels.map(l => l.ndc)).toEqual(["12345-6789", "0573-0160", "12345-6789"]);
    expect(labels.every(l => l.patient === "Jamie Example" && l.mfr === "Sample maker")).toBe(true);
  });
  it("ignores blank and unknown fields while bounding long input", () => {
    const labels = demoLabels({ drug: " ", directions: "x".repeat(200), id: "wrong" });
    expect(labels[0].drug).toBe("Metformin");
    expect(labels[0].directions).toHaveLength(160);
    expect(labels[0].id).toBe("match");
  });
});

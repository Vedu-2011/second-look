// Phase 12: merging label photos field by field, and one answer for several photos of pills.
import { describe, expect, it } from "vitest";
import type { LabelReading } from "@/lib/verdict-engine";
import { combineBottle } from "./combine";
import { labelSummary, mergeLabelReadings } from "./label-merge";
import type { BottleDecision, BottleResult } from "./types";

const conf = (drugName = 0.9, strength = 0.9, ndc = 0.9, form = 0.8) => ({ drugName, strength, ndc, form });
const full: LabelReading = { drugName: "Metformin HCl", strength: "1,000 mg", ndc: "70010-065", form: "tablet", isPrescriptionLabel: true, pharmacyName: "Sample Pharmacy", confidence: conf() };

describe("label photos, merged field by field", () => {
  it("one photo is exactly today's reading", () => {
    const weak = { ...full, ndc: null, confidence: conf(0.4, 0.9, 0.2) };
    expect(mergeLabelReadings([weak])).toEqual({ label: weak, conflicts: [], missing: ["drugName", "ndc"] });
  });
  it("each field comes from the photo that read it confidently", () => {
    const front: LabelReading = { drugName: "Metformin HCl", strength: "1,000 mg", ndc: null, isPrescriptionLabel: true, confidence: conf(0.9, 0.85, 0) };
    const side: LabelReading = { drugName: "Metf", strength: "", ndc: "70010-065", isPrescriptionLabel: false, confidence: conf(0.3, 0, 0.9) };
    const { label, conflicts, missing } = mergeLabelReadings([front, side]);
    expect(label).toMatchObject({ drugName: "Metformin HCl", strength: "1,000 mg", ndc: "70010-065", isPrescriptionLabel: true, confidence: { drugName: 0.9, strength: 0.85, ndc: 0.9 } });
    expect(conflicts).toEqual([]); expect(missing).toEqual([]);
  });
  it("agreeing photos stay one answer: same drug written two ways, 1,000 mg = 1 g, a longer NDC", () => {
    const a: LabelReading = { drugName: "Metformin HCl", strength: "1,000 mg", ndc: "70010-065", confidence: conf() };
    const b: LabelReading = { drugName: "metformin hydrochloride", strength: "1 g", ndc: "70010-0065-01".replace("0065", "065"), confidence: conf(0.95, 0.7, 0.8) };
    const { label, conflicts } = mergeLabelReadings([a, b]);
    expect(conflicts).toEqual([]);
    expect(label).toMatchObject({ drugName: "metformin hydrochloride", ndc: "70010-065-01" });
  });
  it.each([["drugName", "Amoxicillin"], ["strength", "500 mg"], ["ndc", "65862-008"]] as const)("two confident photos that disagree on %s: never guessed, the person picks", (field, other) => {
    const second = { ...full, [field]: other };
    const merged = mergeLabelReadings([full, second]);
    expect(merged.label[field]).toBeUndefined();
    expect(merged.conflicts).toEqual([{ field, options: [{ value: full[field], photos: [0] }, { value: other, photos: [1] }] }]);
    expect(mergeLabelReadings([full, second], { [field]: 1 }).label[field]).toBe(other);
    expect(mergeLabelReadings([full, second], { [field]: 7 }).conflicts).toHaveLength(1); // not a real option
  });
  it("a low-confidence reading never causes a conflict and never wins over a confident one", () => {
    const blurry = { ...full, strength: "500 mg", confidence: conf(0.9, 0.3) };
    expect(mergeLabelReadings([blurry, full])).toMatchObject({ label: { strength: "1,000 mg" }, conflicts: [] });
  });
  it("no field is invented: missing everywhere stays missing", () => {
    const merged = mergeLabelReadings([{ drugName: "Metformin HCl", confidence: conf(0.9, 0, 0) }, { drugName: "Metformin", confidence: conf(0.8, 0, 0) }]);
    expect(merged.label.strength).toBeUndefined(); expect(merged.label.ndc).toBeUndefined();
    expect(merged.missing).toEqual(["strength", "ndc"]);
  });
  it("the summary shows only what was read", () => {
    expect(labelSummary(full)).toBe("Metformin HCl 1,000 mg · NDC 70010-065");
    expect(labelSummary({ drugName: "Metformin HCl" })).toBe("Metformin HCl");
  });
});

const photo = (verdict: BottleDecision["verdict"], pills = 5, title = `${verdict} title`): BottleResult => ({ kind: "bottle", label: full, image: { width: 1, height: 1 }, checkedAt: "", elapsedMs: 0, usage: [],
  pills: Array.from({ length: pills }, (_, i) => ({ number: i + 1, box: { x: 0, y: 0, width: 0, height: 0 } }) as BottleResult["pills"][number]),
  decision: { verdict, title, instruction: `${verdict} instruction`, matched: 0, unreadable: 0, flagged: [] } });

describe("one answer for several photos of pills", () => {
  it("one photo: exactly its own answer", () => {
    expect(combineBottle([photo("UNSURE")])).toMatchObject({ verdict: "UNSURE", title: "UNSURE title", instruction: "UNSURE instruction" });
  });
  it("green only when every photo is fully green", () => {
    expect(combineBottle([photo("MATCH", 8), photo("MATCH", 6)])).toMatchObject({ verdict: "MATCH", title: "All 14 pills in your 2 photos match your label.", photo: null });
    expect(combineBottle([photo("MATCH"), photo("LOOKS_RIGHT")]).verdict).toBe("LOOKS_RIGHT");
    expect(combineBottle([photo("MATCH"), photo("FACE_DOWN"), photo("MATCH")])).toMatchObject({ verdict: "FACE_DOWN", photo: 2, title: "Photo 2: FACE_DOWN title" });
  });
  it("a wrong pill in any photo makes the bottle red", () => {
    const red = combineBottle([photo("MATCH"), photo("MISMATCH", 5, "Pill 4 doesn't match your label."), photo("WARNING")]);
    expect(red).toMatchObject({ verdict: "MISMATCH", photo: 2, title: "Photo 2: Pill 4 doesn't match your label.", instruction: "Don't take any pills from this bottle; call your pharmacy." });
  });
  it("otherwise the weakest answer wins: warning over unsure over face-down", () => {
    expect(combineBottle([photo("FACE_DOWN"), photo("UNSURE")]).verdict).toBe("UNSURE");
    expect(combineBottle([photo("WARNING"), photo("UNSURE")])).toMatchObject({ verdict: "WARNING", photo: 1 });
  });
});

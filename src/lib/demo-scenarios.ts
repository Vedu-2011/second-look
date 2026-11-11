// The three demo bottles (ARCHITECTURE.md), as the label + pill readings phase 2's photo reading will produce.
// Used by the /dev/check prefills, /samples and `npm run smoke:fda`.
import type { LabelReading, PillReading } from "@/lib/verdict-engine";

export type Scenario = { id: string; title: string; expect: string; label: LabelReading; pill: PillReading };

export const SCENARIOS: Scenario[] = [
  {
    id: "match",
    title: "The right pill",
    expect: "MATCH",
    label: { ndc: "63981-598", drugName: "Ibuprofen", strength: "200 mg", form: "capsule" },
    pill: {
      imprintSides: ["IB1"],
      imprintConfidence: 0.95,
      colors: ["blue"],
      colorConfidence: 0.9,
      shape: "capsule",
      shapeConfidence: 0.9,
      form: "capsule",
    },
  },
  {
    id: "different-maker",
    title: "Same medicine, new look",
    expect: "SAME_MEDICINE_DIFFERENT_MAKER",
    label: { ndc: "0573-0169", drugName: "Advil Liqui-Gels", strength: "200 mg", form: "capsule" },
    pill: {
      imprintSides: ["IB1"],
      imprintConfidence: 0.95,
      colors: ["blue"],
      colorConfidence: 0.9,
      shape: "capsule",
      shapeConfidence: 0.9,
      form: "capsule",
    },
  },
  {
    id: "mismatch",
    title: "The wrong pill",
    expect: "MISMATCH",
    label: { ndc: "63981-598", drugName: "Ibuprofen", strength: "200 mg", form: "capsule" },
    pill: {
      imprintSides: ["TYLENOL", "500"],
      imprintConfidence: 0.92,
      colors: ["white"],
      colorConfidence: 0.9,
      shape: "oval",
      shapeConfidence: 0.85,
      form: "tablet",
      guess: { drugName: "Tylenol", strength: "500 mg" },
    },
  },
];

// Original tablet demos retained for engine regression tests.
// The three demo bottles (ARCHITECTURE.md), as the label + pill readings phase 2's photo reading will produce.
// Used by the /dev/check prefills, /samples and `npm run smoke:fda`.
import type { LabelReading, PillReading } from "@/lib/verdict-engine";

export type Scenario = { id: string; title: string; expect: string; label: LabelReading; pill: PillReading };

export const SCENARIOS: Scenario[] = [
  {
    id: "match",
    title: "The right pill",
    expect: "MATCH",
    label: { ndc: "0113-0517", drugName: "Ibuprofen", strength: "200 mg", form: "tablet" },
    pill: {
      imprintSides: ["I2"],
      imprintConfidence: 0.95,
      colors: ["orange"],
      colorConfidence: 0.9,
      shape: "oval",
      shapeConfidence: 0.9,
      form: "tablet",
    },
  },
  {
    id: "different-maker",
    title: "Same medicine, new look",
    expect: "SAME_MEDICINE_DIFFERENT_MAKER",
    label: { ndc: "0573-0160", drugName: "Advil", strength: "200 mg", form: "tablet" },
    pill: {
      imprintSides: ["I2"],
      imprintConfidence: 0.95,
      colors: ["orange"],
      colorConfidence: 0.9,
      shape: "oval",
      shapeConfidence: 0.9,
      form: "tablet",
    },
  },
  {
    id: "mismatch",
    title: "The wrong pill",
    expect: "MISMATCH",
    label: { ndc: "0113-0517", drugName: "Ibuprofen", strength: "200 mg", form: "tablet" },
    pill: {
      imprintSides: ["L484"],
      imprintConfidence: 0.92,
      colors: ["white"],
      colorConfidence: 0.9,
      shape: "oval",
      shapeConfidence: 0.85,
      form: "tablet",
      guess: { drugName: "acetaminophen", strength: "500 mg" },
    },
  },
];

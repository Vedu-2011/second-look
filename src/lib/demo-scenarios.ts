// The three demo bottles (ARCHITECTURE.md, phase 8 addendum 3), as the label + pill readings the photo reader
// produces. Used by the /type prefills, /samples, `npm run smoke:fda` and scripts/record-real-demo.ts.
// Vedhanth's real pills: metformin "G;12" (Granules), amoxicillin "93;2263" (Teva) and Kirkland "IB 200" softgels.
import type { LabelReading, PillReading } from "@/lib/verdict-engine";

export type Scenario = {
  id: string;
  title: string;
  expect: string;
  label: LabelReading;
  pill: PillReading;
  /** Which recorded FDA data (src/lib/fda/__fixtures__/real-demo.json) the saved sample is computed from. */
  fixture: { labelNdc: string; group: string; guessGroup?: string };
};

export const DEMO_NDCS = {
  metformin: "70010-065",
  amoxicillin: "0093-2263",
  advilLiquiGels: "0573-0169",
  /** The NDC printed on Vedhanth's Kirkland bottle. Its FDA record says "IB1"; the softgels inside say "IB 200". */
  kirkland: "63981-598",
  /** An active FDA record for the "IB200" blue softgel look (Bionpharma). */
  ib200: "69452-212",
  tylenol: "50580-937",
} as const;

export const DEMO_GROUPS = {
  metformin1000: "861004",
  amoxicillin500: "308192",
  ibuprofenCapsule: "310964",
  advilCapsule: "731533",
  acetaminophen500Tylenol: "209459",
} as const;

export const SCENARIOS: Scenario[] = [
  {
    id: "match",
    title: "The right pill",
    expect: "MATCH",
    label: { ndc: DEMO_NDCS.metformin, drugName: "Metformin", strength: "1,000 mg", form: "tablet" },
    pill: {
      imprintSides: ["G", "12"],
      imprintConfidence: 0.95,
      colors: ["white"],
      colorConfidence: 0.9,
      shape: "oval",
      shapeConfidence: 0.9,
      form: "tablet",
    },
    fixture: { labelNdc: DEMO_NDCS.metformin, group: DEMO_GROUPS.metformin1000 },
  },
  {
    id: "different-maker",
    title: "Same medicine, new look",
    expect: "SAME_MEDICINE_DIFFERENT_MAKER",
    label: { ndc: DEMO_NDCS.advilLiquiGels, drugName: "Advil Liqui-Gels", strength: "200 mg", form: "capsule" },
    pill: {
      // Kirkland softgel: faint printed "IB 200" on a translucent teal gel.
      imprintSides: ["IB 200"],
      imprintConfidence: 0.9,
      colors: ["turquoise"],
      colorConfidence: 0.85,
      shape: "capsule",
      shapeConfidence: 0.9,
      form: "capsule",
    },
    fixture: { labelNdc: DEMO_NDCS.advilLiquiGels, group: DEMO_GROUPS.ibuprofenCapsule },
  },
  {
    id: "mismatch",
    title: "The wrong pill",
    expect: "MISMATCH",
    label: { ndc: DEMO_NDCS.metformin, drugName: "Metformin", strength: "1,000 mg", form: "tablet" },
    pill: {
      // Amoxicillin after the flip: "93" on one side, "2263" on the other.
      imprintSides: ["93", "2263"],
      imprintConfidence: 0.92,
      colors: ["white"],
      colorConfidence: 0.9,
      shape: "oval",
      shapeConfidence: 0.85,
      form: "tablet",
      guess: { drugName: "amoxicillin", strength: "500 mg" },
    },
    fixture: { labelNdc: DEMO_NDCS.metformin, group: DEMO_GROUPS.metformin1000, guessGroup: DEMO_GROUPS.amoxicillin500 },
  },
];

import * as z from "zod";
import type { LabelReading, PillReading } from "@/lib/verdict-engine";

const confidence = z.number().min(0).max(1);
const nullableText = (max: number) => z.string().trim().max(max).nullable();

export const labelReadingSchema = z.object({
  drugName: nullableText(120),
  strength: nullableText(40),
  dosageForm: nullableText(40),
  ndc: nullableText(20),
  pharmacyName: nullableText(120),
  directions: nullableText(300),
  isPrescriptionLabel: z.boolean(),
  confidence: z.object({
    drugName: confidence,
    strength: confidence,
    ndc: confidence,
    dosageForm: confidence,
  }),
});

const color = z.enum([
  "black", "blue", "brown", "gray", "green", "orange", "pink", "purple", "red", "turquoise", "white", "yellow", "off-white", "beige",
]);

export const pillReadingSchema = z.object({
  imprintSides: z.array(z.string().trim().max(40)).max(4),
  imprintConfidence: confidence,
  colors: z.array(color).max(3),
  colorConfidence: confidence,
  shape: z.string().trim().max(30),
  shapeConfidence: confidence,
  form: z.string().trim().max(20),
  pillVisible: z.boolean(),
  multiplePills: z.boolean(),
  photoProblems: z.array(z.enum(["blur", "glare", "too far", "imprint side down"])).max(4),
  scored: z.boolean().nullable(),
  guess: z.object({ drugName: z.string().trim().min(1).max(120), strength: z.string().trim().max(40).nullable() }).nullable(),
});

export type AiLabelReading = z.infer<typeof labelReadingSchema>;
export type AiPillReading = z.infer<typeof pillReadingSchema>;

export function toLabelReading(value: AiLabelReading): LabelReading {
  return {
    ndc: value.ndc,
    drugName: value.drugName ?? undefined,
    strength: value.strength ?? undefined,
    form: value.dosageForm ?? undefined,
    pharmacyName: value.pharmacyName ?? undefined,
    directions: value.directions ?? undefined,
    isPrescriptionLabel: value.isPrescriptionLabel,
    confidence: { ...value.confidence, form: value.confidence.dosageForm },
  };
}

export function toPillReading(value: AiPillReading): PillReading {
  return {
    ...value,
    guess: value.guess ? { drugName: value.guess.drugName, strength: value.guess.strength ?? undefined } : null,
    scored: value.scored ?? undefined,
  };
}

// Bottle mode: one reading per pill visible in a pile crop (prompt pill-group-v1). Boxes are fractions of the crop.
const fraction = z.number().min(0).max(1);
export const pillGroupReadingSchema = z.object({
  pills: z.array(z.object({
    center: z.object({ x: fraction, y: fraction }),
    box: z.object({ x: fraction, y: fraction, width: fraction, height: fraction }),
    imprintSides: z.array(z.string().trim().max(40)).max(4),
    imprintConfidence: confidence,
    colors: z.array(color).max(3),
    colorConfidence: confidence,
    shape: z.string().trim().max(30),
    shapeConfidence: confidence,
    form: z.string().trim().max(20),
    partlyHidden: z.boolean(),
    photoProblems: z.array(z.enum(["blur", "glare", "too far", "imprint side down"])).max(4),
  })).max(20),
  pileCount: z.number().int().min(0).max(40),
  countConfidence: confidence,
  somePillsMayBeHidden: z.boolean(),
});
export type AiPillGroupReading = z.infer<typeof pillGroupReadingSchema>;

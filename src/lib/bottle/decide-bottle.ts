import { colorsFromCodes, compareColors, normalizeColor } from "@/lib/match/color";
import { compareShapes, normalizeShape, shapeFromCode } from "@/lib/match/shape";
import { COLOR_MIN_CONFIDENCE, SHAPE_MIN_CONFIDENCE } from "@/lib/verdict-engine";
import type { BottleDecision, BottlePill } from "./types";

/** The engine still owns every pill verdict. Appearance alone can only add a bottle warning. */
export function appearanceWarning({ result }: BottlePill): string | undefined {
  if (result.verdict !== "UNSURE" || !result.labelProduct || result.pill.pillVisible === false || result.pill.multiplePills) return;
  const p = result.pill, expected = result.labelProduct;
  const colors = p.colors.map(normalizeColor).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const expectedColors = colorsFromCodes(expected.colorCodes), expectedShape = shapeFromCode(expected.shapeCode), shape = normalizeShape(p.shape);
  const colorDiffers = p.colorConfidence >= COLOR_MIN_CONFIDENCE && compareColors(expectedColors, colors) === "different";
  const shapeDiffers = p.shapeConfidence >= SHAPE_MIN_CONFIDENCE && compareShapes(expectedShape, shape) === "different";
  if (!colorDiffers && !shapeDiffers) return;
  const found = [p.colorConfidence >= COLOR_MIN_CONFIDENCE ? colors.join(" / ") : "", p.shapeConfidence >= SHAPE_MIN_CONFIDENCE ? shape : ""].filter(Boolean).join(" ");
  const label = [expectedColors.join(" / "), expectedShape].filter(Boolean).join(" ");
  return `${found || "Appearance"} vs ${label || "the label's FDA record"}`;
}
export function decideBottle(pills: readonly BottlePill[]): BottleDecision {
  const mismatches = pills.filter((p) => p.result.verdict === "MISMATCH");
  const warnings = pills.filter((p) => appearanceWarning(p));
  const matched = pills.filter((p) => ["MATCH", "SAME_MEDICINE_DIFFERENT_MAKER"].includes(p.result.verdict)).length;
  const unreadable = pills.filter((p) => p.result.verdict === "UNSURE").length;
  const base = { matched, unreadable, flagged: [...new Set([...mismatches, ...warnings].map((p) => p.number))] };
  if (mismatches.length) {
    const first = mismatches[0], name = first.result.identifiedAs?.title;
    return { ...base, verdict: "MISMATCH", title: `Pill ${first.number} doesn't match your label.`, instruction: `${name ? `Its imprint is listed for ${name}. ` : ""}Don't take any pills from this bottle; call your pharmacy.` };
  }
  if (warnings.length) {
    const first = warnings[0];
    return { ...base, verdict: "WARNING", title: `Pill ${first.number} looks different from your label's medicine.`, instruction: `${appearanceWarning(first)}. Don't take it; check with your pharmacist. We couldn't confirm its identity.` };
  }
  if (pills.length && matched === pills.length) return { ...base, verdict: "MATCH", title: `All ${pills.length} detected pills match your label.`, instruction: "Check that every pill in your photo has a number. This checks only the pills we found in this photo." };
  return { ...base, verdict: "UNSURE", title: `${matched} pills match; ${unreadable} couldn't be read.`, instruction: "Flip those pills and take another photo. Ask your pharmacist before taking any pill we couldn't confirm." };
}

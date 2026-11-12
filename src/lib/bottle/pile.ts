// Piles: people pour pills, they don't space them out. Separate pills still come from the proven segmenter; each
// touching region is cropped at full resolution and read ONCE by the pile reader (prompt pill-group-v1). Every pill it
// reports becomes an ordinary reading that goes through the same engine as any other pill. Never green on its own:
// decideBottle caps a photo with a pile at "Looks right".
import sharp from "sharp";
import type { ImageInput, ReadOptions } from "@/lib/ai/client";
import type { AiPillGroupReading } from "@/lib/ai/schemas";
import type { PillReading } from "@/lib/verdict-engine";
import type { BottleClump, BottlePile, NormalizedBox } from "./types";

/** At most this many pile reads per photo; any other touching region stays "Not read". */
export const MAX_PILES = 3;
/** One pile read counts like this many pill reads in the quota. */
export const PILE_READ_UNITS = 5;
/** Below this the count is a guess, so the photo can't be finished: shake and snap again. */
export const PILE_COUNT_MIN_CONFIDENCE = 0.6;
/** A partly hidden pill never confirms or contradicts on its own: below the engine's 0.7 imprint bar. */
export const PARTLY_HIDDEN_CONFIDENCE_CAP = 0.6;
const CROP_PAD = 0.15, MAX_CROP_EDGE = 2000;

export type PileReader = (image: ImageInput, options: ReadOptions) => Promise<AiPillGroupReading>;
export type PilePill = { box: NormalizedBox; reading: PillReading; partlyHidden: boolean; clump: number };

/** The touching regions we read, largest first; cutoffs at the edge are never read as piles. */
export function pilesToRead(clumps: readonly BottleClump[]) {
  return clumps.map((c, i) => ({ c, i })).filter(({ c }) => c.kind === "touching")
    .sort((a, b) => b.c.box.width * b.c.box.height - a.c.box.width * a.c.box.height).slice(0, MAX_PILES).map(({ i }) => i);
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** The padded crop around a touching region, as a box of the whole photo. */
export function pileCropBox(box: NormalizedBox): NormalizedBox {
  const pad = CROP_PAD * Math.max(box.width, box.height);
  const x = clamp(box.x - pad), y = clamp(box.y - pad);
  return { x, y, width: clamp(box.x + box.width + pad) - x, height: clamp(box.y + box.height + pad) - y };
}
export async function pileCrop(photo: Buffer, box: NormalizedBox): Promise<ImageInput> {
  const oriented = sharp(await sharp(photo).rotate().toBuffer());
  const { width = 0, height = 0 } = await oriented.metadata();
  const crop = pileCropBox(box);
  const left = Math.floor(crop.x * width), top = Math.floor(crop.y * height);
  const region = { left, top, width: Math.max(1, Math.min(width - left, Math.ceil(crop.width * width))), height: Math.max(1, Math.min(height - top, Math.ceil(crop.height * height))) };
  const jpeg = await oriented.extract(region).resize({ width: MAX_CROP_EDGE, height: MAX_CROP_EDGE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  return { mediaType: "image/jpeg", base64: jpeg.toString("base64") };
}

const inside = (p: { x: number; y: number }, b: NormalizedBox) => p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
/**
 * Maps one pile reading back onto the photo. Drops pills whose center lands on a pill the segmenter already numbered
 * (the padded crop can include a neighbour) or on a pill an earlier pile already reported.
 */
export function pilePills(group: AiPillGroupReading, clump: number, clumpBox: NormalizedBox, taken: readonly NormalizedBox[]): { pills: PilePill[]; pile: BottlePile } {
  const crop = pileCropBox(clumpBox), seen = [...taken], pills: PilePill[] = [];
  for (const p of group.pills) {
    const center = { x: crop.x + p.center.x * crop.width, y: crop.y + p.center.y * crop.height };
    if (seen.some((b) => inside(center, b))) continue;
    const x = clamp(crop.x + p.box.x * crop.width), y = clamp(crop.y + p.box.y * crop.height);
    let box = { x, y, width: clamp(crop.x + (p.box.x + p.box.width) * crop.width) - x, height: clamp(crop.y + (p.box.y + p.box.height) * crop.height) - y };
    // A box that misses its own center is unusable; fall back to a small box around the center.
    if (!inside(center, box) || box.width <= 0 || box.height <= 0) { const s = Math.min(crop.width, crop.height) * 0.12; box = { x: clamp(center.x - s / 2), y: clamp(center.y - s / 2), width: s, height: s }; }
    seen.push(box);
    pills.push({ box, partlyHidden: p.partlyHidden, clump, reading: {
      imprintSides: p.imprintSides,
      imprintConfidence: p.partlyHidden ? Math.min(p.imprintConfidence, PARTLY_HIDDEN_CONFIDENCE_CAP) : p.imprintConfidence,
      colors: p.colors, colorConfidence: p.colorConfidence, shape: p.shape, shapeConfidence: p.shapeConfidence, form: p.form,
      pillVisible: true, multiplePills: false, photoProblems: p.photoProblems, guess: null,
    } });
  }
  return { pills, pile: { read: pills.length, count: Math.max(group.pileCount, pills.length), countConfidence: group.countConfidence, mayBeHidden: group.somePillsMayBeHidden } };
}
/** Pills in pile order: top to bottom, then left to right, so numbers read naturally after the separate pills. */
export const readingOrder = (a: { box: NormalizedBox }, b: { box: NormalizedBox }) => {
  const ay = a.box.y + a.box.height / 2, by = b.box.y + b.box.height / 2;
  return Math.abs(ay - by) < Math.min(a.box.height, b.box.height) * 0.5 ? a.box.x - b.box.x : ay - by;
};

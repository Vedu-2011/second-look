import sharp from 'sharp';
import { compareImprint, normalizeToken, tokenizeImprint } from '@/lib/match/imprint';
import { compareColors, normalizeColor } from '@/lib/match/color';
import { compareShapes, normalizeShape } from '@/lib/match/shape';
import type { PillReading } from '@/lib/verdict-engine';
import type { BottlePill } from './types';
export const MAX_EXTRA_READS = 5;
export const borderline = (p: PillReading) => p.imprintConfidence >= .5 && p.imprintConfidence < .7 && p.pillVisible !== false && !p.multiplePills && tokenizeImprint(p.imprintSides).length > 0;
/** Different pixels, independent request; no prompt or single-pill threshold change. */
export async function secondReadImage(crop: Buffer) {
  const image = sharp(crop), m = await image.metadata();
  return image.resize({ width: Math.min(3200, (m.width ?? 1) * 2), height: Math.min(3200, (m.height ?? 1) * 2), fit: 'inside' }).png().toBuffer();
}
export function agreeReadings(first: PillReading, second: PillReading): { reading: PillReading; evidence: NonNullable<BottlePill['doubleRead']> } {
  const a = compareImprint(first.imprintSides, second.imprintSides, false), b = compareImprint(second.imprintSides, first.imprintSides, false);
  const colors = (p: PillReading) => p.colors.map(normalizeColor).filter((c): c is NonNullable<typeof c> => !!c);
  const agrees = borderline(first) && second.imprintConfidence >= .5 && second.pillVisible !== false && !second.multiplePills && !first.viewConflict && !second.viewConflict && a.result === 'exact' && !a.partial && b.result === 'exact' && !b.partial && compareColors(colors(first), colors(second)) !== 'different' && compareShapes(normalizeShape(first.shape), normalizeShape(second.shape)) !== 'different';
  return { reading: { ...first, imprintConfidence: agrees ? .7 : Math.min(first.imprintConfidence, .69), colorConfidence: Math.min(first.colorConfidence, second.colorConfidence), shapeConfidence: Math.min(first.shapeConfidence, second.shapeConfidence) }, evidence: { agreed: agrees, firstConfidence: first.imprintConfidence, secondConfidence: second.imprintConfidence, firstImprint: first.imprintSides, secondImprint: second.imprintSides } };
}

/** Agreement on an explicitly incomplete expected fragment is not a complete transcription. */
export function expectedFragment(reading: PillReading, expected?: { imprintRaw: string } | null) {
  const text = normalizeToken(reading.imprintSides.join(''));
  const full = normalizeToken(tokenizeImprint(expected?.imprintRaw).join(''));
  return Boolean(text && full && text.length < full.length && full.includes(text));
}

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

// Phase 11d: one letter off the label's own imprint (TB 200 / JB 200 / IB 260 for IB 200) is the classic misread.
export function editDistance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}
/**
 * The read side that is exactly ONE character (after dropping spaces, case and punctuation) from the label's FDA
 * imprint, whole or per side. Null when any side matches exactly or nothing is that close.
 */
export function nearMissSide(reading: PillReading, expectedRaw?: string | null): string | null {
  if (!expectedRaw) return null;
  const sides = expectedRaw.split(';').map(normalizeToken).filter(Boolean);
  const expected = [...new Set([sides.join(''), ...sides])];
  const read = reading.imprintSides.map((side) => ({ side, text: normalizeToken(side) })).filter((s) => s.text);
  if (read.some((s) => expected.includes(s.text))) return null;
  return read.find((s) => s.text.length >= 2 && expected.some((e) => editDistance(s.text, e) === 1))?.side ?? null;
}
/** "IB200" → "IB 200", "G;12" → "G 12" — the way people read a print out loud. */
export const spacedImprint = (raw: string) => raw.split(';').map((s) => normalizeToken(s).replace(/(?<=[A-Z])(?=\d)|(?<=\d)(?=[A-Z])/g, ' ')).filter(Boolean).join(' ');

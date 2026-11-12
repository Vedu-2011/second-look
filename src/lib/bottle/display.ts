// Presentation only. None of these states participate in verdicts, quota or follow-up planning.
import type { BottleClump, BottlePill, BottleResult } from './types';
export type BottleDisplayState = 'match' | 'matchedEarlier' | 'mismatch' | 'faceDown' | 'odd' | 'unsure' | 'looksLike';
export function bottleDisplayState(p: BottlePill): BottleDisplayState {
  if (p.carried) return p.previousVerdict === 'MATCH' || p.previousVerdict === 'SAME_MEDICINE_DIFFERENT_MAKER' ? 'matchedEarlier' : 'unsure';
  if (p.result.verdict === 'MISMATCH') return 'mismatch';
  if (p.consensus) return 'looksLike';
  if (p.faceDown) return 'faceDown';
  if (p.odd) return 'odd';
  return p.result.verdict === 'UNSURE' ? 'unsure' : 'match';
}
/** A wrong pill's row leads with what its print says (phase 11b). Words only; the verdict is the engine's. */
export function mismatchLead(p: BottlePill): string | null {
  const print = p.result.pill.imprintSides.join(' / ');
  if (p.result.verdict !== 'MISMATCH' || !print) return null;
  const drug = (p.result.label.drugName ?? '').split(/\s+/)[0] ?? '';
  const named = drug ? drug[0].toUpperCase() + drug.slice(1).toLowerCase() : '';
  if (p.result.identifiedAs?.title) return `Its print says ${print} — that's ${p.result.identifiedAs.title}, not your ${named || 'medicine'}.`;
  if (!named) return `Its print says ${print} — that's not on any version of your medicine.`;
  return `Its print says ${print} — that's not on any ${named.toLowerCase()}${p.result.label.strength ? ` ${p.result.label.strength}` : ''}.`;
}
export const BOTTLE_SYMBOL = { match: '✓', matchedEarlier: '✓', mismatch: '×', faceDown: '↻', odd: '!', unsure: '?', looksLike: '≈' } as const;
export const BOTTLE_WORD = { match: 'Matches', matchedEarlier: 'Matched in your first photo', mismatch: "Doesn't match", faceDown: 'Writing face-down', odd: 'Looks different', unsure: "Can't tell", looksLike: "Looks like the confirmed ones" } as const;
export const BOTTLE_LEGEND = { ...BOTTLE_WORD, matchedEarlier: 'Matched earlier' } as const;
export const needsAttention = (p: BottlePill) => !['match', 'matchedEarlier', 'looksLike'].includes(bottleDisplayState(p)) || Boolean(p.odd || p.appearanceWarning);
export function bottleSummary(pills: readonly BottlePill[]) {
  const current = pills.filter(p => !p.carried && ['MATCH','SAME_MEDICINE_DIFFERENT_MAKER'].includes(p.result.verdict)).length;
  const earlier = pills.filter(p => bottleDisplayState(p) === 'matchedEarlier').length;
  const wrong = pills.filter(p => !p.carried && p.result.verdict === 'MISMATCH').length;
  const looks = pills.filter(p => bottleDisplayState(p) === 'looksLike').length;
  const unsure = pills.length - current - earlier - wrong - looks;
  return [looks ? `${looks} look alike` : '', current ? `${current} match` : '', wrong ? (earlier ? `${wrong} ${wrong === 1 ? "mismatch" : "mismatches"}` : `${wrong} ${wrong === 1 ? "doesn't" : "don't"} match`) : '', earlier ? `${earlier} matched earlier` : '', unsure ? `${unsure} ${earlier ? "unsure" : "can't tell"}` : ''].filter(Boolean).join(' · ');
}
const numbers = (ns: number[]) => ns.length > 1 ? `${ns.slice(0,-1).join(', ')} and ${ns.at(-1)}` : String(ns[0]);
export function followUpDisplayNote(result: BottleResult) {
  const f = result.followUp;
  if (!f) return null;
  if (f.mode === 'fresh') return f.note;
  if (!f.reread.length) return 'These readings are from your first photo. We did not read them again.';
  const read = f.reread.length === result.pills.length ? `We read all ${f.reread.length} pills again.` : `We read ${f.reread.length === 1 ? 'pill' : 'pills'} ${numbers(f.reread)} again.`;
  return `${read}${f.reused ? ` The other ${f.reused} ${f.reused === 1 ? 'is' : 'are'} from your first photo.` : ''}`;
}

const confirmedNow = (p: BottlePill) => !p.carried && ['MATCH', 'SAME_MEDICINE_DIFFERENT_MAKER'].includes(p.result.verdict);
export const isRedMode = (pills: readonly BottlePill[]) => pills.some(p => !p.carried && p.result.verdict === 'MISMATCH');
/** Red mode: the screen is about the wrong pill. Other pins dim; a confirmed match keeps its ✓. */
export type MarkerState = BottleDisplayState | 'dimMatch' | 'dim';
export function markerState(p: BottlePill, red: boolean): MarkerState {
  const s = bottleDisplayState(p);
  if (!red || s === 'mismatch') return s;
  return confirmedNow(p) ? 'dimMatch' : 'dim';
}
export const MARKER_SYMBOL: Record<MarkerState, string> = { ...BOTTLE_SYMBOL, dimMatch: '✓', dim: '' };
/** "The other 9 pills: 7 match, 2 not fully checked — it doesn't matter now, this bottle has a wrong pill." */
export function otherPillsLine(pills: readonly BottlePill[]) {
  const others = pills.filter(p => !(p.result.verdict === 'MISMATCH' && !p.carried));
  if (!others.length) return null;
  const match = others.filter(confirmedNow).length, rest = others.length - match;
  const parts = [match ? `${match} match` : '', rest ? `${rest} not fully checked` : ''].filter(Boolean).join(', ');
  return `The other ${others.length} ${others.length === 1 ? 'pill' : 'pills'}: ${parts} — it doesn't matter now, this bottle has a wrong pill.`;
}
/** Every mark that appears on screen, in a fixed order, including the dashed "Not read" circle. */
export function bottleLegend(pills: readonly BottlePill[], clumps: readonly BottleClump[], red: boolean) {
  const order: MarkerState[] = red ? ['mismatch', 'dimMatch', 'dim'] : ['match', 'mismatch', 'unsure', 'odd', 'faceDown', 'matchedEarlier', 'looksLike'];
  const words: Record<MarkerState, string> = { ...BOTTLE_LEGEND, dimMatch: 'Matches', dim: 'Not fully checked' };
  const present = new Set(pills.map(p => markerState(p, red)));
  const items: { key: MarkerState | 'notRead'; symbol: string; label: string }[] = order.filter(s => present.has(s)).map(s => ({ key: s, symbol: MARKER_SYMBOL[s], label: words[s] }));
  if (clumps.some(c => !c.pile && !c.minor && !c.readAsOne)) items.push({ key: 'notRead', symbol: '◌', label: 'Not read' });
  return items;
}

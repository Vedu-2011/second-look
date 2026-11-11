// Presentation only. None of these states participate in verdicts, quota or follow-up planning.
import type { BottlePill, BottleResult } from './types';
export type BottleDisplayState = 'match' | 'matchedEarlier' | 'mismatch' | 'faceDown' | 'odd' | 'unsure' | 'looksLike';
export function bottleDisplayState(p: BottlePill): BottleDisplayState {
  if (p.carried) return p.previousVerdict === 'MATCH' || p.previousVerdict === 'SAME_MEDICINE_DIFFERENT_MAKER' ? 'matchedEarlier' : 'unsure';
  if (p.result.verdict === 'MISMATCH') return 'mismatch';
  if (p.consensus) return 'looksLike';
  if (p.faceDown) return 'faceDown';
  if (p.odd) return 'odd';
  return p.result.verdict === 'UNSURE' ? 'unsure' : 'match';
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

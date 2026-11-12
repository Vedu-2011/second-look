import { tokenizeImprint, normalizeToken } from '@/lib/match/imprint';
import { isConfirmed } from './decide-bottle';
import { oddOnesOut } from './lookalike';
import type { BottleClump, BottlePill } from './types';

/** Appearance support, never a new engine MATCH. All references must be current imprint confirmations. */
export function applyConsensus(input: readonly BottlePill[], clumps: readonly BottleClump[] = [], unresolved = 0): BottlePill[] {
  const pills = input.map(p => { const { consensus: _old, ...rest } = p; void _old; return rest as BottlePill; });
  if (clumps.some(c => !c.readAsOne) || unresolved || pills.some(p => p.result.verdict === 'MISMATCH' || p.odd || p.appearanceWarning)) return pills;
  if (pills.some(p => !p.features)) return pills;
  const group = oddOnesOut(pills.map(p => p.features));
  if (!group || group.odd.size) return pills;
  const confirmed = pills.filter(p => !p.carried && isConfirmed(p));
  if (confirmed.length < 2) return pills;
  const imprintOf = (p: BottlePill) => (p.result.matchedProduct ?? p.result.expected)?.imprintRaw ?? '';
  const canonical = (s: string) => tokenizeImprint(s).sort().join('|');
  const references = new Set(confirmed.map(p => canonical(imprintOf(p))));
  if (references.size !== 1 || ![...references][0]) return pills;
  const tokens = tokenizeImprint(imprintOf(confirmed[0]));
  const targets = [...tokens, tokens.join(''), [...tokens].reverse().join('')];
  // Literal contiguous fragments only, with NO look-alike-character folding. IB1 cannot support IB200.
  const consistent = (p: BottlePill) => p.result.pill.imprintSides.map(normalizeToken).filter(Boolean).every(s => targets.some(t => t.includes(s)));
  if (pills.some(p => p.doubleRead?.agreed === false || !consistent(p))) return pills;
  for (const p of pills) {
    if (p.carried || isConfirmed(p) || p.result.verdict !== 'UNSURE' || p.result.pill.pillVisible === false || p.result.pill.multiplePills) continue;
    p.consensus = { confirmedNumbers: confirmed.map(c => c.number), partialConsistent: tokenizeImprint(p.result.pill.imprintSides).length > 0 };
  }
  return pills;
}

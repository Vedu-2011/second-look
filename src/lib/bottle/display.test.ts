import { describe, expect, it } from 'vitest';
import { SAMPLE_RESULTS } from '@/lib/sample-results';
import { decideBottle } from './decide-bottle';
import { BOTTLE_WORD, bottleDisplayState, bottleSummary, followUpDisplayNote, needsAttention } from './display';
import type { BottlePill, BottleResult } from './types';
const pill = (previousVerdict?: BottlePill['previousVerdict']): BottlePill => ({ number: 2, box: { x: .1, y: .1, width: .2, height: .1 }, result: { ...structuredClone(SAMPLE_RESULTS[0].result), verdict: 'UNSURE' }, carried: true, previousVerdict });
describe('bottle display provenance does not affect decisions', () => {
  it.each(['MATCH','SAME_MEDICINE_DIFFERENT_MAKER'] as const)('carried %s is matched earlier, never a current match', verdict => {
    const p = pill(verdict);
    expect(bottleDisplayState(p)).toBe('matchedEarlier'); expect(BOTTLE_WORD[bottleDisplayState(p)]).toBe('Matched in your first photo');
    expect(p.result.verdict).toBe('UNSURE'); expect(decideBottle([p]).verdict).not.toBe('MATCH');
    expect(needsAttention(p)).toBe(false);
  });
  it.each(['UNSURE',undefined] as const)('uncertain or missing history stays a question mark: %s', verdict => {
    expect(bottleDisplayState(pill(verdict))).toBe('unsure'); expect(needsAttention(pill(verdict))).toBe(true);
  });
  it('a reread uses its new verdict rather than the earlier match', () => {
    const p = { ...pill('MATCH'), carried: false, reread: true }; p.result.verdict = 'MISMATCH';
    expect(bottleDisplayState(p)).toBe('mismatch'); expect(needsAttention(p)).toBe(true);
  });
  it('new appearance warnings still need attention even with an earlier match', () => {
    expect(needsAttention({ ...pill('MATCH'), odd: 'a different shape' })).toBe(true);
  });
  it('counts earlier matches separately from current confirmations', () => {
    const current = { ...pill(), carried: false }; current.result.verdict = 'MATCH';
    const wrong = { ...pill(), carried: false }; wrong.result.verdict = 'MISMATCH';
    expect(bottleSummary([current,wrong,pill('MATCH'),pill('UNSURE')])).toBe("1 match · 1 mismatch · 1 matched earlier · 1 unsure");
  });
  it('uses plain follow-up copy without changing the stored note', () => {
    const result = { pills: Array(10), followUp: { mode: 'reread', reread: [5], reused: 9, note: 'Original safety note' } } as BottleResult;
    expect(followUpDisplayNote(result)).toBe('We read pill 5 again. The other 9 are from your first photo.');
    expect(result.followUp!.note).toBe('Original safety note');
  });
});

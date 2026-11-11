import {describe,it,expect} from 'vitest';
import {listingEvidence,listingSummary} from './listing-evidence';
import {SAMPLE_RESULTS,REAL_DEMO} from './sample-results';
import {SCENARIOS} from './demo-scenarios';
import {recordedLead} from './recorded-lead';
const reference=REAL_DEMO.products['63981-598'];
describe('FDA listing evidence, presentation only',()=>{
 it('handles a single seller without claiming a unique manufacturer',()=>{const e=listingEvidence(reference,[reference])!;expect(e.products).toHaveLength(1);expect(listingSummary(e)).toBe('Matches 1 FDA-listed version, sold by Costco Wholesale.');});
 it('counts product codes separately from unique sellers and puts own NDC first',()=>{const e=listingEvidence(reference,REAL_DEMO.groups['310964'].products,reference.productCode)!;expect(e.products[0].productCode).toBe(reference.productCode);expect(e.products).toHaveLength(14);expect(e.sellers).toHaveLength(12);expect(listingSummary(e)).toContain('and 9 others');});
 it('deduplicates packages, normalizes seller casing, and does not compare size',()=>{const second={...reference,productCode:'222222222',labeler:' costco   wholesale ',sizeMm:99};const e=listingEvidence(reference,[reference,{...reference},second])!;expect(e.products).toHaveLength(2);expect(e.sellers).toHaveLength(1);});
 it('excludes different imprint, color and shape',()=>{for(const change of [{imprintRaw:'ZZZ'},{colorCodes:['C48325']},{shapeCode:'C48348'}])expect(listingEvidence(reference,[{...reference,...change,productCode:'222222222'}])!.products).toHaveLength(1);});
 it('discloses missing sellers without inventing names',()=>{const e=listingEvidence({...reference,labeler:undefined},[])!;expect(e.unknownSellerCount).toBe(1);expect(listingSummary(e)).toContain('sellers not listed');});
 it('returns no evidence without a matched record',()=>expect(listingEvidence(null,[reference])).toBeNull());
 it('describes mismatch identification as listed, not a unique seller',()=>expect(listingSummary(SAMPLE_RESULTS[2].result.identifiedListings!,true)).toMatch(/^Listed in 16 FDA-listed versions/));
});
describe('real demo bottle fixtures',()=>{
 it.each(SAMPLE_RESULTS.map(s=>[s.scenario.id,s] as const))('%s returns its required verdict',(_id,s)=>expect(s.result.verdict).toBe(s.scenario.expect));
 it('verifies generic and Advil capsules really share the same group',()=>{expect(REAL_DEMO.groups['731533'].generic.rxcui).toBe('310964');expect(REAL_DEMO.groups['310964'].members.map(m=>m.rxcui)).toContain('731533');});
 it('keeps an exact discontinued package MATCH with the calm note',()=>{expect(SAMPLE_RESULTS[0].result.matchedProduct?.active).toBe(false);expect(SAMPLE_RESULTS[0].result.reasons.join(' ')).toContain('The FDA lists this exact package as no longer marketed; the pill matches its record.');});
 it('identifies TYLENOL / 500 as Tylenol from recorded FDA data',()=>{expect(SAMPLE_RESULTS[2].result.identifiedAs?.brand).toBe('Tylenol');expect(SAMPLE_RESULTS[2].result.identifiedAs?.title).toBe('Acetaminophen 500 mg');expect(recordedLead(SCENARIOS[2].pill)?.drugName.toLowerCase()).toContain('acetaminophen');});
});

// Network-free computed examples from live FDA metadata recorded for the real demo bottles.
import type { CheckResult } from '@/lib/check-service';
import { SCENARIOS, type Scenario } from '@/lib/demo-scenarios';
import real from '@/lib/fda/__fixtures__/real-demo.json';
import type { LabelMeta, Product } from '@/lib/fda/types';
import { decide, type EngineData } from '@/lib/verdict-engine';
import { listingEvidence } from './listing-evidence';
export const DEMO_RECORDED_ON = real.recordedAt.slice(0,10);
export const REAL_DEMO = real;
export function sampleResult(s: Scenario): CheckResult {
 const groups=real.groups as Record<string,(typeof real.groups)['310964']>;
 const group=groups[s.fixture.group];
 const data: EngineData={labelProduct:(real.products as Record<string,Product>)[s.fixture.labelNdc],labelDrug:group.generic,sameDrugProducts:group.products,guessProducts:s.fixture.guessGroup?groups[s.fixture.guessGroup].products:[]};
 const result=decide(s.label,s.pill,data);
 return {...result,matchingListings:listingEvidence(result.matchedProduct,data.sameDrugProducts,data.labelProduct?.productCode),identifiedListings:listingEvidence(result.identifiedAs,data.guessProducts??[]),label:s.label,pill:s.pill,labelProduct:data.labelProduct??null,labels:real.labels as Record<string,LabelMeta>,checkedAt:real.recordedAt,timings:{label:0,drug:0,guess:0,dailymed:0,total:0}};
}
export const SAMPLE_RESULTS=SCENARIOS.map(s=>({scenario:s,result:sampleResult(s)}));

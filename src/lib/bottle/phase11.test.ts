import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { SAMPLE_RESULTS } from '@/lib/sample-results';
import { applyConsensus } from './consensus';
import { decideBottle } from './decide-bottle';
import { agreeReadings, secondReadImage } from './double-read';
import { captureCoaching } from './coaching';
import { layout, grid } from './test-scenes';
import { segmentBottle } from './segment';
import type { BottlePill, PillFeatures } from './types';
import type { PillReading } from '@/lib/verdict-engine';
const feature: PillFeatures={length:120,width:60,aspect:2,area:.01,relativeArea:1,lab:[45,-15,-5]};
const reading=(text:string, confidence=.6):PillReading=>({imprintSides:text?[text]:[],imprintConfidence:confidence,colors:['blue'],colorConfidence:.9,shape:'capsule',shapeConfidence:.9,pillVisible:true});
const pill=(n:number, confirmed=false,text=''):BottlePill=>{const result=structuredClone(SAMPLE_RESULTS[0].result);result.verdict=confirmed?'MATCH':'UNSURE';result.pill=reading(text,confirmed?.9:.6);result.label.drugName='Ibuprofen';result.labelProduct=null;result.expected={...result.expected!,imprintRaw:'IB200'};result.matchedProduct=confirmed?result.expected:null;return {number:n,box:{x:.1,y:.1,width:.1,height:.05},features:{...feature},result};};
const pills=()=>[pill(1,true,'IB200'),pill(2,true,'IB200'),pill(3,false,'IB 2'),pill(4,false,'200'),pill(5)];
describe('current-photo consensus',()=>{
 it('two references support consistent fragments and blank visible look-alikes, never engine MATCH',()=>{const r=applyConsensus(pills());expect(r.slice(2).every(p=>p.consensus)).toBe(true);expect(r.slice(2).every(p=>p.result.verdict==='UNSURE')).toBe(true);const d=decideBottle(r);expect(d.verdict).toBe('LOOKS_RIGHT');expect(d.instruction).toContain('2 of 5');});
 it.each(['IB 1','93'])('a conflicting fragment blocks the whole group: %s',text=>{const p=pills();p[2].result.pill=reading(text);expect(applyConsensus(p).some(p=>p.consensus)).toBe(false);});
 it('one reference is not enough, and past references do not count',()=>{const p=pills();p[1].carried=true;expect(applyConsensus(p).some(p=>p.consensus)).toBe(false);});
 it.each(['red','odd','clump','cutoff','unresolved','disagree'] as const)('%s blocks support',kind=>{const p=pills();if(kind==='red')p[4].result.verdict='MISMATCH';if(kind==='odd')p[4].odd='a different shape';if(kind==='disagree')p[4].doubleRead={agreed:false,firstConfidence:.6,secondConfidence:.6,firstImprint:['IB200'],secondImprint:['IB1']};const clumps=kind==='clump'||kind==='cutoff'?[{kind:kind==='cutoff'?'cutoff' as const:'touching' as const,box:p[0].box}]:[];expect(applyConsensus(p,clumps,kind==='unresolved'?1:0).some(p=>p.consensus)).toBe(false);});
 it('all confirmed pills retain ordinary MATCH',()=>{const p=pills().map(p=>({...p,result:{...p.result,verdict:'MATCH' as const,pill:reading('IB200',.9)}}));expect(decideBottle(applyConsensus(p)).verdict).toBe('MATCH');});
 it('a carried uncertain pill is never inferred',()=>{const p=pills();p[4].carried=true;const r=applyConsensus(p);expect(r[4].consensus).toBeUndefined();expect(decideBottle(r).verdict).not.toBe('LOOKS_RIGHT');});
});
describe('independent borderline agreement',()=>{
 it('normalizes spacing but records both original confidences',()=>{const r=agreeReadings(reading('IB 200'),reading('IB200',.6));expect(r.reading.imprintConfidence).toBe(.7);expect(r.evidence).toMatchObject({agreed:true,firstConfidence:.6,secondConfidence:.6});});
 it.each(['IB1','93','IB20'])('different normalized text stays uncertain: %s',text=>{const r=agreeReadings(reading('IB200'),reading(text,.95));expect(r.evidence.agreed).toBe(false);expect(r.reading.imprintConfidence).toBeLessThan(.7);});
 it('does not fold look-alike letters or trust an invisible/multiple/very-low-confidence second crop',()=>{expect(agreeReadings(reading('I2'),reading('12')).evidence.agreed).toBe(false);for(const change of [{pillVisible:false},{multiplePills:true},{imprintConfidence:.2}])expect(agreeReadings(reading('IB200'),{...reading('IB200'),...change}).evidence.agreed).toBe(false);});
 it('creates a different, enlarged image for the independent call',async()=>{const original=await sharp({create:{width:80,height:40,channels:3,background:'white'}}).png().toBuffer();const other=await secondReadImage(original);expect((await sharp(other).metadata()).width).toBe(160);expect(other.equals(original)).toBe(false);});
});
describe('synthetic softgels, split conservatism and coaching',()=>{
 it.each([.15,.25])('finds faint translucent teal on dark gray at alpha %s',async alpha=>{const svg=`<svg width="1200" height="1000"><rect width="1200" height="1000" fill="#2f2f33"/>${grid().map(p=>`<ellipse cx="${p.cx}" cy="${p.cy}" rx="60" ry="32" fill="#148f91" fill-opacity="${alpha}"/>`).join('')}</svg>`;const r=await segmentBottle(await sharp(Buffer.from(svg)).png().toBuffer());expect(r.boxes).toHaveLength(9);});
 it('splits a narrow-neck pair into two convex similar parts',async()=>{const r=await segmentBottle(await layout([{cx:450,cy:400},{cx:556,cy:400}]));expect(r.boxes).toHaveLength(2);expect(r.clumps).toHaveLength(0);});
 it('refuses three touching pills and keeps an ambiguous pair circled',async()=>{const three=await segmentBottle(await layout([{cx:350,cy:400},{cx:456,cy:400},{cx:562,cy:400}]));expect(three.clumps.length).toBeGreaterThan(0);const uneven=await segmentBottle(await layout([{cx:450,cy:400},{cx:530,cy:400,rx:35,ry:20}]));expect(uneven.clumps.length).toBeGreaterThan(0);});
 it('coaches tiny pills and multiple clumps, but not normal frame sizes',()=>{const base={image:{width:1200,height:1000},features:[{...feature,length:24}],clumps:[]};expect(captureCoaching(base)[0]).toContain('Move closer');expect(captureCoaching({...base,features:[{...feature,length:48}]})).toEqual([]);expect(captureCoaching({...base,features:[],clumps:[{kind:'touching',box:pill(1).box},{kind:'touching',box:pill(2).box}]}).join(' ')).toContain('Spread them out');});
});
it('agreement on an expected fragment is distinguished from complete-print agreement', async()=>{
 const {expectedFragment}=await import('./double-read');
 expect(expectedFragment(reading('IB 2'),{imprintRaw:'IB200'})).toBe(true);
 expect(expectedFragment(reading('200'),{imprintRaw:'IB200'})).toBe(true);
 expect(expectedFragment(reading('IB1'),{imprintRaw:'IB200'})).toBe(false);
 expect(expectedFragment(reading('IB200'),{imprintRaw:'IB200'})).toBe(false);
});
it.each([30,60,90])('splits only a narrow-neck pair rotated %s degrees',async angle=>{
 const t=angle*Math.PI/180;
 const found=await segmentBottle(await layout([{cx:450,cy:400,angle},{cx:450+106*Math.cos(t),cy:400+106*Math.sin(t),angle}]));
 expect(found.boxes).toHaveLength(2);expect(found.clumps).toHaveLength(0);
});
it('does not turn dark gray color noise into foreground pills',async()=>{
 const w=500,h=400,data=Buffer.alloc(w*h*3);
 for(let i=0;i<data.length;i++)data[i]=42+((i*17)%7)-3;
 const image=await sharp(data,{raw:{width:w,height:h,channels:3}}).png().toBuffer();
 await expect(segmentBottle(image)).rejects.toMatchObject({code:'none'});
});

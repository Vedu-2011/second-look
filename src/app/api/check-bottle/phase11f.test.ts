// Regression: piles reserve five reader-equivalents, so a valid bottle can need >4 quota units.
import { beforeEach, expect, it, vi } from 'vitest';
import { SAMPLE_RESULTS } from '@/lib/sample-results';
import { scene } from '@/lib/bottle/test-scenes';
import { FdaError } from '@/lib/fda/http';
vi.mock('next/server', () => ({ connection: async () => {} }));
vi.mock('@/lib/redis', () => ({ getRedis: () => null, key: (v:string) => 'sl:'+v }));
vi.mock('@/lib/rate-limit', async original => {
  const real=await original<typeof import('@/lib/rate-limit')>();
  return {...real,consumeCheckLimit:vi.fn(real.consumeCheckLimit)};
});
vi.mock('@/lib/bottle/segment', async original => {
  const real=await original<typeof import('@/lib/bottle/segment')>();
  return {...real,segmentBottle:vi.fn(real.segmentBottle)};
});
vi.mock('@/lib/ai/readers', () => ({readLabel:vi.fn(),readPill:vi.fn(),readPillGroup:vi.fn()}));
vi.mock('@/lib/check-service', () => ({resolveLabelData:vi.fn(),runResolvedCheck:vi.fn()}));
const {POST}=await import('./route');
const {segmentBottle}=await import('@/lib/bottle/segment');
const {consumeCheckLimit,clearRateLimitForTests,clearPaidForTests}=await import('@/lib/rate-limit');
const {clearReadCacheForTests}=await import('@/lib/ai/read-cache');
const {readLabel,readPill,readPillGroup}=await import('@/lib/ai/readers');
const {resolveLabelData,runResolvedCheck}=await import('@/lib/check-service');
const source=SAMPLE_RESULTS[0].result;
beforeEach(()=>{
 vi.clearAllMocks();clearRateLimitForTests();clearPaidForTests();clearReadCacheForTests();
 vi.mocked(resolveLabelData).mockResolvedValue({} as never);
 vi.mocked(readLabel).mockResolvedValue(source.label);
 vi.mocked(readPill).mockResolvedValue({...source.pill,imprintConfidence:.95});
 vi.mocked(readPillGroup).mockResolvedValue({pills:[],pileCount:0,countConfidence:.9,somePillsMayBeHidden:false});
 vi.mocked(runResolvedCheck).mockImplementation(async(label,pill)=>({...structuredClone(source),label,pill}));
});
async function input(){const photo=await scene(1);const form=new FormData();for(const name of ['labelImage','bottleImage'])form.set(name,new Blob([new Uint8Array(photo)],{type:'image/png'}),'test.png');form.set('checkAnyway','1');return new Request('http://localhost/api/check-bottle',{method:'POST',body:form});}
const events=async(r:Response)=>(await r.text()).trim().split('\n').map(s=>JSON.parse(s));
it('reserves a synthetic 11-separate +3-pile bottle with real quota validation, not a fake FDA failure',async()=>{
 const {segmentBottle:realSegment}=await vi.importActual<typeof import('@/lib/bottle/segment')>('@/lib/bottle/segment');
 const prepared=await realSegment(await scene(11));
 prepared.clumps=[0,1,2].map(i=>({kind:'touching',relativeArea:2,box:{x:.1+i*.3,y:.7,width:.15,height:.15}}));
 vi.mocked(segmentBottle).mockResolvedValueOnce(prepared);
 const output=await events(await POST(await input()));
 expect(consumeCheckLimit).toHaveBeenNthCalledWith(2,'unknown',5); // ceil((11+3*5)/5)-1
 expect(output.at(-1).type).toBe('result');
 expect(resolveLabelData).toHaveBeenCalledTimes(1);
 expect(readPill).toHaveBeenCalledTimes(11);
 expect(readPillGroup).toHaveBeenCalledTimes(3);
 expect(output.some(e=>e.type==='error')).toBe(false);
});
it('logs a real internal exception and never describes it as an FDA outage',async()=>{
 const error=new TypeError('test internal bottle failure');
 vi.mocked(resolveLabelData).mockRejectedValueOnce(error);
 const log=vi.spyOn(console,'error').mockImplementation(()=>{});
 try{
  const output=await events(await POST(await input()));
  expect(output.at(-1)).toEqual({type:'error',retryable:true,message:'Something went wrong on our side checking this pill. Please try again.'});
  expect(log).toHaveBeenCalledWith('Bottle check failed',expect.objectContaining({name:'TypeError',message:error.message,stack:expect.any(String)}));
 }finally{log.mockRestore();}
});
it('still distinguishes a real FDA failure',async()=>{
 vi.mocked(resolveLabelData).mockRejectedValueOnce(new FdaError('timeout','mock lookup timed out','https://rxnav.nlm.nih.gov/REST/test'));
 const log=vi.spyOn(console,'error').mockImplementation(()=>{});
 try{expect((await events(await POST(await input()))).at(-1)).toEqual({type:'error',retryable:true,message:'The FDA database took too long to answer. Please try again in a moment.'});}finally{log.mockRestore();}
});

// Manual, once-after-freeze real photo test. No label photo exists: use the label declared in phase-11.md.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { runBottleCheck } from '@/lib/bottle/check-bottle';
import { segmentBottle } from '@/lib/bottle/segment';
import { captureCoaching } from '@/lib/bottle/coaching';
import { phase10bReaders } from './lib/phase10b-readers';
async function main() {
  const live = process.argv.includes('--live');
  const budget = phase10bReaders({ live, file: 'test-images/bottle/generated/phase11-usage.json', budgetUsd: .30, scope: 'phase11' });
  const path='test-images/real/extra/user-test-ibuprofen-tylenol.jpg';
  const image=await readFile(path);
  const prepared=await segmentBottle(image);
  const coaching=captureCoaching(prepared);
  const failures:string[]=[];
  const reservations:number[]=[];
  // Test-adapter throttle only: two pending reservations leave ample space under the durable .30 cap.
  let active=0; const waiting:Array<()=>void>=[];
  const readPill:NonNullable<Parameters<typeof runBottleCheck>[4]>['readPill']=async(image,options)=>{
    if(active>=2)await new Promise<void>(resolve=>waiting.push(resolve)); else active++;
    try{return await budget.readPill(image,options);}catch(e){failures.push(e instanceof Error?e.name:'Reading failure');throw e;}
    finally{const next=waiting.shift();if(next)next();else active--;}
  };
  const result=await runBottleCheck({mediaType:'image/jpeg',base64:''},image,async n=>{reservations.push(n);},()=>{}, {
    prepared, checkAnyway: true,
    label:{ndc:'69452-212',drugName:'Ibuprofen',strength:'200 mg',form:'capsule'},
    readPill,
  });
  if(!result)throw new Error('No bottle result');
  await writeFile('docs/screenshots/phase-11/user-result.json',JSON.stringify(result,null,2)+'\n');
  const report={scope:'Single untuned functional test, not accuracy evidence. Known label supplied, not read by AI.',frozenCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSha256:createHash('sha256').update(image).digest('hex'),mode:live?'live; durable .30 cap':'cache only',coaching,checkAnyway:'Diagnostic run explicitly continued after coaching, if offered.',decision:result.decision,pills:result.pills.map(p=>({number:p.number,imprint:p.result.pill.imprintSides,confidence:p.result.pill.imprintConfidence,verdict:p.result.verdict,doubleRead:p.doubleRead,consensus:p.consensus,odd:p.odd})),clumps:result.clumps,readReservations:reservations,usage:budget.summary(),readerFailures:failures};
  await writeFile('docs/screenshots/phase-11/user-run.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));budget.report();
  if(failures.length)process.exitCode=1;
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Real test failed');process.exitCode=1;});

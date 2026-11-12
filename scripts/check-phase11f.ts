// Free deterministic verification: no AI imports/calls. Real images are audited only AFTER synthetic rules freeze.
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {captureCoaching,coachingFacts,COACHING_RULES} from '@/lib/bottle/coaching';
import {segmentBottle,SegmentationError} from '@/lib/bottle/segment';
import {layout,grid} from '@/lib/bottle/test-scenes';
async function main(){
 const out='docs/screenshots/phase-11f', generated='test-images/bottle/generated/phase11f';
 await mkdir(out,{recursive:true});await mkdir(generated,{recursive:true});
 const scenes={
  far:await layout(Array.from({length:6},(_,i)=>({cx:450+(i%3)*90,cy:400+Math.floor(i/3)*100,rx:12,ry:8}))),
  close:await layout(grid()),
  'close-pile':await layout([{cx:370,cy:400,rx:85,ry:40},{cx:490,cy:400,rx:85,ry:40},{cx:720,cy:600,rx:85,ry:40},{cx:840,cy:600,rx:85,ry:40},...Array.from({length:8},(_,i)=>({cx:200+i*90,cy:220,rx:7,ry:7}))]),
 };
 const synthetic=[];
 for(const [name,bytes] of Object.entries(scenes)){
  await writeFile(`${generated}/${name}.png`,bytes);
  const segmented=await segmentBottle(bytes);
  synthetic.push({name,pills:segmented.boxes.length,regions:segmented.clumps.length,tips:captureCoaching(segmented),facts:coachingFacts(segmented)});
 }
 const real=[];
 for(const name of (await readdir('test-images/real',{recursive:true})).filter(n=>/\.(jpg|jpeg|png|webp)$/i.test(n)).sort()){
  const bytes=await readFile('test-images/real/'+name),sha256=createHash('sha256').update(bytes).digest('hex');
  try{const segmented=await segmentBottle(bytes);real.push({name,sha256,status:'segmented',pills:segmented.boxes.length,regions:segmented.clumps.length,tips:captureCoaching(segmented),facts:coachingFacts(segmented)});}
  catch(error){if(!(error instanceof SegmentationError))throw error;real.push({name,sha256,status:'retake-before-coaching',code:error.code,message:error.message});}
 }
 const report={scope:'Free functional coaching audit. No AI, drug-identification accuracy or threshold tuning on real photos.',frozenCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),rules:COACHING_RULES,synthetic,real,falseMoveCloser:real.filter(r=>'tips'in r&&r.tips?.length).map(r=>r.name)};
 await writeFile(out+'/coaching-audit.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
 if(report.falseMoveCloser.length||synthetic.find(r=>r.name==='far')?.tips.length!==1||synthetic.some(r=>r.name!=='far'&&r.tips.length))process.exitCode=1;
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Coaching audit failed');process.exitCode=1;});

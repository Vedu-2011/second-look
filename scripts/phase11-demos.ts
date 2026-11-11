// Synthetic UI scenarios with mocked transcription and real FDA resolution. No paid AI calls.
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { runBottleCheck } from '@/lib/bottle/check-bottle';
import { layout } from '@/lib/bottle/test-scenes';
async function main(){
 const image=await layout(Array.from({length:10},(_,i)=>({cx:160+i%5*220,cy:300+Math.floor(i/5)*360,color:'#348c96'})));
 await writeFile('test-images/bottle/generated/phase11-consensus.png',image);
 let count=0;
 const result=await runBottleCheck({mediaType:'image/png',base64:''},image,async()=>{},()=>{}, {label:{ndc:'0573-0169',drugName:'Ibuprofen',strength:'200 mg',form:'capsule'},readPill:async()=>({imprintSides:count++<2?['IB 200']:[],imprintConfidence:count<=2?.95:0,colors:['turquoise'],colorConfidence:.95,shape:'capsule',shapeConfidence:.95,pillVisible:true})});
 if(result?.decision.verdict!=='LOOKS_RIGHT')throw new Error('Synthetic consensus did not produce expected separate outcome');
 await writeFile('docs/screenshots/phase-11/consensus-demo.json',JSON.stringify(result,null,2)+'\n');
 const tiny=await sharp(Buffer.from('<svg width="1200" height="1000"><rect width="1200" height="1000" fill="#333"/><ellipse cx="500" cy="500" rx="12" ry="8" fill="white"/></svg>')).png().toBuffer();
 await writeFile('test-images/bottle/generated/phase11-tiny.png',tiny);
 console.log(JSON.stringify({scope:'Synthetic drawing, mocked transcription, real FDA data; not accuracy evidence',decision:result.decision,numbered:result.pills.length}));
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Demo build failed');process.exitCode=1;});

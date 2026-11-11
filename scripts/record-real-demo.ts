// Record live parsed FDA metadata for the real demo bottles without changing older research fixtures.
import {writeFile} from 'node:fs/promises';
import {productByNdc,drugGroup} from '../src/lib/fda/rxnav';
import {SCENARIOS} from '../src/lib/demo-scenarios';
import {decide} from '../src/lib/verdict-engine';
import {labelMeta} from '../src/lib/fda/dailymed';
async function main() {
const codes=['63981-598','0573-0169','50580-937'];
const products=await Promise.all(codes.map(code=>productByNdc(code)));
if(products.some(p=>!p))throw Error('A real demo NDC was not found');
const groups=await Promise.all(['310964','731533','209459'].map(id=>drugGroup(id)));
const evidenceIds=SCENARIOS.flatMap(s=>decide(s.label,s.pill,{labelProduct:products[s.id==='different-maker'?1:0],labelDrug:groups[0]!.generic,sameDrugProducts:groups[0]!.products,guessProducts:groups[2]!.products}).evidence.flatMap(e=>e.setId?[e.setId]:[]));
const ids=[...new Set([...products.map(p=>p!.setId).filter(Boolean),...evidenceIds])] as string[];
const labels=Object.fromEntries(await Promise.all(ids.map(async id=>[id,await labelMeta(id)])));
const snapshot={recordedAt:new Date().toISOString(),sources:[...new Set([...products.map(p=>`https://rxnav.nlm.nih.gov/REST/ndcproperties.json?id=${p!.productCode}&ndcstatus=ALL`),...groups.flatMap(g=>g!.members.map(m=>`https://rxnav.nlm.nih.gov/REST/ndcproperties.json?id=${m.rxcui}&ndcstatus=ALL`))])],products:Object.fromEntries(codes.map((id,i)=>[id,products[i]])),groups:Object.fromEntries(['310964','731533','209459'].map((id,i)=>[id,groups[i]])),labels};
await writeFile('src/lib/fda/__fixtures__/real-demo.json',JSON.stringify(snapshot,null,2)+'\n');
for(const [id,p] of Object.entries(snapshot.products))console.log(id,JSON.stringify(p));
for(const [id,g] of Object.entries(snapshot.groups))console.log(id,'generic',g?.generic.rxcui,'members',g?.members.map(m=>m.rxcui).join(','),'products',g?.products.length);

}
main().catch(e=>{console.error(e);process.exitCode=1});

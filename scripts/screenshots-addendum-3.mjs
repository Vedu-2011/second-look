// Phase 8 addendum 3: live typed checks for the final demo set, plus screenshots at 375 and 1440.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const base=process.argv[2]||'http://localhost:3000';
const out='docs/screenshots/phase-8-addendum-3';await mkdir(out,{recursive:true});
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const p=await b.newPage({reducedMotion:'reduce'});const errors=[];p.on('pageerror',e=>errors.push(e.message));
let photoPosts=0;await p.route('**/api/check',r=>{photoPosts++;return r.abort()});
const checks=[['match','The right pill','MATCH','861004'],['different-maker','Same medicine, new look','SAME_MEDICINE_DIFFERENT_MAKER','310964'],['mismatch','The wrong pill','MISMATCH','861004']];
try{for(const width of [375,1440]){await p.setViewportSize({width,height:1000});for(const [id,title,verdict,group] of checks){
 await p.goto(base+'/type',{waitUntil:'networkidle'});await p.getByRole('button',{name:title,exact:true}).click();
 const [r]=await Promise.all([p.waitForResponse(r=>r.url().endsWith('/api/verify')),p.getByRole('button',{name:'Check my pill',exact:true}).click()]);const result=await r.json();assert.equal(r.status(),200);assert.equal(result.verdict,verdict);assert(result.productsCompared>0);assert(result.evidence.some(e=>e.source==='NLM RxNorm'&&e.rxcui===group),`${id}: RxNorm ${group} evidence`);
 if(id!=='mismatch'){assert(result.matchingListings.products.length>1);assert(result.matchingListings.sellers.length>1);}else{assert.match(result.identifiedAs.title,/amoxicillin 500 mg/i);assert(result.identifiedListings.sellers.some(s=>/teva/i.test(s)),'Teva listed');}
 await p.getByRole('article',{name:'Check result'}).waitFor();await p.evaluate(()=>document.fonts.ready);
 await p.screenshot({path:`${out}/type-${id}-${width}.png`,fullPage:true});
 await p.getByRole('article',{name:'Check result'}).screenshot({path:`${out}/result-${id}-${width}.png`,style:'.site-header{visibility:hidden!important}'});
 if(width===375)console.log(JSON.stringify({check:id,verdict:result.verdict,ms:result.timings.total,identified:result.identifiedAs?.title,products:result.matchingListings?.products.length??result.identifiedListings?.products.length,sellers:result.matchingListings?.sellers.length??result.identifiedListings?.sellers.length}));
 }for(const route of ['/','/samples','/samples/match','/samples/different-maker','/samples/mismatch','/labels']){await p.goto(base+route,{waitUntil:'networkidle'});await p.evaluate(()=>document.fonts.ready);assert(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),`${route} scrolls sideways at ${width}`);await p.screenshot({path:`${out}/${route==='/'?'home':route.slice(1).replace('/','-')}-${width}.png`,fullPage:true});}}
 assert.equal(photoPosts,0);assert.deepEqual(errors,[]);console.log('PASS addendum-3 typed checks, widths, runtime errors; zero photo posts');
}finally{await b.close()}

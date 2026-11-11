// Actual saved share pages, no paid photo requests. Run after the phase11 deployment is Ready.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
const base=process.argv[2]||'https://second-look-git-feat-phase-10c-polish-vedhanth.vercel.app';
const out='docs/screenshots/phase-11';
const saved=JSON.parse(await fs.readFile(out+'/saved-previews.json','utf8'));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const reports=[];
try{
 for(const width of [375,1440])for(const name of ['consensus-demo','user-result']){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/check**',route=>route.abort());
  const response=await page.goto(base+'/result/'+saved[name].id,{waitUntil:'networkidle'});
  assert.equal(response.status(),200);await page.locator('#bottle-verdict').waitFor();
  assert.equal(await page.locator('[data-pill-number]').count(),name==='consensus-demo'?10:4);
  assert.equal(await page.locator('img[alt^="Your photo of the pills"]').count(),0);
  if(name==='consensus-demo'){
   await page.getByText('Looks right',{exact:true}).waitFor();
   assert.equal(await page.locator('[data-pill-group="lookalikes"]').getAttribute('open'),null);
   await page.locator('[data-pill-number="3"]').click();
   assert.equal(await page.locator('[data-pill-group="lookalikes"]').getAttribute('open'),'');
   assert.equal(await page.evaluate(()=>document.activeElement?.id),'bottle-pill-3');
   const evidence=page.locator('#bottle-pill-3 details > summary');await evidence.focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('#bottle-pill-3 details').getAttribute('open'),'');
   assert.match(await page.locator('#bottle-pill-3').innerText(),/not an imprint confirmation/);
  }else{
   assert.match(await page.locator('#bottle-verdict').innerText(),/doesn't match/);
   assert.match(await page.getByLabel('Bottle summary',{exact:true}).innerText(),/5 circled, not checked/);
   assert.match(await page.locator('#bottle-pill-3').innerText(),/Acetaminophen 500 mg/);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  await page.screenshot({path:`${out}/share-${name}-${width}.png`,fullPage:true});
  reports.push({name,width,status:response.status(),errors,overflow:false,photosStored:false});await page.close();
 }
 const free=[];
 for(const path of ['/check','/samples','/labels','/type','/api/lookup?ndc=garbage']){
  const response=await fetch(base+path);assert.equal(response.status,path.startsWith('/api/')?400:200);free.push({path,status:response.status});
 }
 await fs.writeFile(out+'/preview-checks.json',JSON.stringify({base,scope:'Actual saved share pages, keyboard/focus/evidence and free routes. All paid photo endpoints blocked.',reports,free},null,2)+'\n');
 console.log(JSON.stringify({reports,free}));
}finally{await browser.close();}

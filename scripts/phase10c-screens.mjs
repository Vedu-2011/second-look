// Free display checks. Real result JSON is replayed for live capture; no AI request reaches the server.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
const root=fileURLToPath(new URL('../',import.meta.url));
const base=process.argv[2]||'http://localhost:3001';
const out=root+'docs/screenshots/phase-10c';
const before=JSON.parse(await fs.readFile(root+'docs/screenshots/phase-10b/real-before.json','utf8'));
const after=JSON.parse(await fs.readFile(out+'/real-after-display.json','utf8'));
const ids={before:'63a1a5cd-0ffe-440b-839c-3e89470697e3',after:'1537e0b0-9286-467d-84d2-9f2ff8425ff6'};
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const reports=[];
async function verify(page,kind,width,result,photo){
  await page.locator('#bottle-verdict').waitFor();
  assert.equal(await page.locator('[data-pill-number]').count(),10);
  assert.equal(await page.getByText('Is every pill numbered?',{exact:true}).count(),photo?1:0);
  if(!photo){assert.equal(await page.locator('[data-bottle-overlay] img').count(),0);await page.getByText('Each dot is a pill, in the spot it was in your photo. We never save photos.',{exact:true}).waitFor();}
  const summary=await page.getByLabel('Bottle summary',{exact:true}).innerText();
  assert.equal(summary,result===before?"8 match · 1 doesn't match · 1 can't tell":"1 mismatch · 8 matched earlier · 1 unsure");
  const summaryLines=await page.getByLabel('Bottle summary',{exact:true}).evaluate(e=>{const r=document.createRange();r.selectNodeContents(e);return r.getClientRects().length;});
  assert.equal(summaryLines,1,'summary remains one line at the requested width');
  assert.equal(await page.locator('#bottle-pill-2').isVisible(),false,'matches start collapsed');
  assert.equal(await page.locator('#bottle-pill-5').isVisible(),true);
  let geometry=null;
  if(result===before){
    geometry=await page.evaluate(({box,photo})=>{
      const overlay=document.querySelector('[data-bottle-overlay]').getBoundingClientRect(), ring=document.querySelector('[data-pill-ring="5"]').getBoundingClientRect(), dot=document.querySelector('[data-pill-number="5"]').getBoundingClientRect();
      const actual={x:ring.x+ring.width/2,y:ring.y+ring.height/2};
      const expected=photo?{x:overlay.x+(box.x+box.width/2)*overlay.width,y:overlay.y+(box.y+box.height/2)*overlay.height}:{x:dot.x+dot.width/2,y:dot.y+dot.height/2};
      return {dx:actual.x-expected.x,dy:actual.y-expected.y,ringWidth:ring.width,dotWidth:dot.width};
    },{box:before.pills[4].box,photo});
    assert(Math.abs(geometry.dx)<1&&Math.abs(geometry.dy)<1,'ring centered on the pill/dot');
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.addStyleTag({content:'nextjs-portal{display:none!important}'});await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:`${out}/${kind}-${width}.png`,fullPage:true});
  await page.screenshot({path:`${out}/${kind}-hero-${width}.png`});
  await page.locator('[data-bottle-overlay]').screenshot({path:`${out}/${kind}-overlay-${width}.png`});
  await page.getByRole('button',{name:/^Pill 2:/}).click();
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'bottle-pill-2');
  assert.equal(await page.locator('#bottle-pill-2').isVisible(),true,'dot expands its containing group');
  await page.keyboard.press('Tab');await page.keyboard.press('Enter');
  assert.equal(await page.locator('#bottle-pill-2 details').getAttribute('open'),'');
  reports.push({kind,width,summary,summaryLines,geometry,collapsedGroups:true,selectionFocus:true,keyboardEvidence:true,photo});
}
try{
 for(const width of [375,1440,1920]){
  for(const state of ['before','after']){
   const page=await browser.newPage({viewport:{width,height:1080},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/check**',r=>r.abort());
   const response=await page.goto(base+'/result/'+ids[state],{waitUntil:'networkidle'});assert.equal(response.status(),200);
   await verify(page,'share-'+state,width,state==='before'?before:after,false);assert.deepEqual(errors,[]);await page.close();
  }
  const page=await browser.newPage({viewport:{width,height:1080},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));let result=before,replayRequests=0;
  await page.route('**/api/check**',async route=>{assert(route.request().url().endsWith('/api/check-bottle'));replayRequests++;await route.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({type:'result',result,shareId:ids[result===before?'before':'after'],continuationToken:'0'.repeat(64)})+'\n'});});
  async function upload(file){await page.locator('input[type=file]:not([capture])').setInputFiles(root+file);await page.locator('img[alt^="Your"]').first().waitFor();}
  await page.goto(base+'/check',{waitUntil:'networkidle'});await upload('test-images/real/bottle/label.jpg');await page.getByRole('button',{name:'Next: photo of the pills',exact:true}).click();await upload('test-images/real/bottle/pills.jpg');await page.getByRole('button',{name:'Check my pills',exact:true}).last().click();
  await verify(page,'live-before',width,before,true);
  result=after;await page.locator('#bottle-verdict').locator('..').getByRole('button').first().click();await upload('test-images/real/bottle/pills-flipped.jpg');await page.getByRole('button',{name:'Check again',exact:true}).click();await page.getByText('We read pill 5 again. The other 9 are from your first photo.',{exact:true}).waitFor();
  await verify(page,'live-after',width,after,true);assert.equal(replayRequests,2);assert.deepEqual(errors,[]);await page.close();
 }
}finally{await browser.close();}
await fs.writeFile(out+'/browser-checks.json',JSON.stringify({base,note:'Saved real readings; live bottle API intercepted, shares read actual stored results. Zero paid calls.',reports},null,2));
console.log(JSON.stringify(reports));

// Local API smoke uses an intentionally disabled paid quota. Browser tests never perform an AI read.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=fileURLToPath(new URL('../',import.meta.url));
const base=process.argv[2]||'http://localhost:3001';
const local=base.includes('localhost');
const tag=process.argv[3]||(local?'local':'preview');
const out=root+'docs/screenshots/phase-11f';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const reports=[];
try{
 for(const width of [375,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/check',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Check my pills',exact:true}).first().waitFor();
  await page.screenshot({path:`${out}/${tag}-check-${width}.png`,fullPage:true});
  if(local){
   const upload=async file=>{await page.locator('input[type=file]:not([capture])').setInputFiles(root+file);await page.locator('img[alt^="Your"]').first().waitFor();};
   await upload('test-images/real/bottle/label.jpg');await page.getByRole('button',{name:'Next: photo of the pills',exact:true}).click();
   await upload('test-images/bottle/generated/phase11f/far.png');
   let response=page.waitForResponse(r=>r.url().endsWith('/api/check-bottle'));
   await page.getByRole('button',{name:'Check my pills',exact:true}).last().click();
   const far=await response;assert.equal(far.status(),200);assert.match(await far.text(),/"type":"coaching"/);
   await page.getByRole('region',{name:'Photo tips before reading'}).waitFor();
   await page.screenshot({path:`${out}/${tag}-far-coaching-${width}.png`,fullPage:true});
   await page.getByRole('button',{name:'Retake',exact:true}).click();
   await upload('test-images/bottle/generated/phase11f/close-pile.png');
   await page.screenshot({path:`${out}/${tag}-close-pile-${width}.png`,fullPage:true});
   response=page.waitForResponse(r=>r.url().endsWith('/api/check-bottle'));
   await page.getByRole('button',{name:'Check my pills',exact:true}).last().click();
   const close=await response;assert.equal(close.status(),429);assert.match(await close.text(),/today's limit/);
   assert.equal(await page.getByRole('region',{name:'Photo tips before reading'}).count(),0);
   reports.push({width,far:'actual free coaching',close:'passed coaching; intentional zero-paid-quota fuse returned429',errors});
  }else{
   await page.route('**/api/check**',r=>r.abort());
   for(const path of ['/samples','/labels','/result/63a1a5cd-0ffe-440b-839c-3e89470697e3','/result/1537e0b0-9286-467d-84d2-9f2ff8425ff6']){
    const r=await page.goto(base+path,{waitUntil:'networkidle'});assert.equal(r.status(),200);
    if(path.startsWith('/result/')){await page.locator('#bottle-verdict').waitFor();assert.match(await page.locator('#bottle-verdict').innerText(),/doesn't match/);}
   }
   reports.push({width,freeRoutes:'samples,labels,both real metformin shares HTTP200; mismatches preserved',errors});
  }
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.close();
 }
}finally{await browser.close();}
await fs.writeFile(`${out}/${tag}-browser.json`,JSON.stringify({base,scope:local?'Actual local API, empty AI key and DAILY_CHECK_CAP=0: no generation can run.':'Actual deployed free pages/shares; photo endpoints blocked.',reports},null,2)+'\n');
console.log(JSON.stringify(reports));

// Synthetic consensus + real free coaching + saved real user result. No paid request reaches the server.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=fileURLToPath(new URL('../',import.meta.url)), out=root+'docs/screenshots/phase-11';
const base=process.argv[2]||'http://localhost:3001';
const consensus=JSON.parse(await fs.readFile(out+'/consensus-demo.json','utf8'));
let user=null;try{user=JSON.parse(await fs.readFile(out+'/user-result.json','utf8'));}catch{}
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const reports=[];
try{
 for(const width of [375,1440])for(const name of ['consensus','coaching',...(user?['user']:[])]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));let realPreparation=0,replay=0;
  await page.route('**/api/check**',async route=>{
   if(name==='coaching'){realPreparation++;assert.equal(realPreparation,1);await route.continue();return;}
   replay++;await route.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({type:'result',result:name==='user'?user:consensus,shareId:'00000000-0000-4000-8000-000000000000',continuationToken:'0'.repeat(64)})+'\n'});
  });
  await page.goto(base+'/check',{waitUntil:'networkidle'});
  const upload=async file=>{await page.locator('input[type=file]:not([capture])').setInputFiles(root+file);await page.locator('img[alt^="Your"]').first().waitFor();};
  await upload('test-images/real/different-maker/label.jpg');await page.getByRole('button',{name:'Next: photo of the pills',exact:true}).click();
  await upload(name==='coaching'?'test-images/bottle/generated/phase11-tiny.png':name==='user'?'test-images/real/extra/user-test-ibuprofen-tylenol.jpg':'test-images/bottle/generated/phase11-consensus.png');
  await page.getByRole('button',{name:'Check my pills',exact:true}).last().click();
  if(name==='coaching'){
   await page.getByRole('region',{name:'Photo tips before reading'}).waitFor();
   await page.getByRole('button',{name:'Retake',exact:true}).waitFor();await page.getByRole('button',{name:'Check anyway',exact:true}).waitFor();
   assert.equal(realPreparation,1);
  }else{
   await page.locator('#bottle-verdict').waitFor();
   if(name==='consensus'){await page.getByText('Looks right',{exact:true}).waitFor();assert.equal(await page.locator('[data-pill-number]').count(),10);assert.match(await page.getByLabel('Bottle summary',{exact:true}).innerText(),/8 look alike.*2 match/);}
   assert.equal(replay,1);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  await page.addStyleTag({content:'nextjs-portal{display:none!important}'});await page.screenshot({path:`${out}/${name}-${width}.png`,fullPage:true});await page.screenshot({path:`${out}/${name}-hero-${width}.png`});
  if(name==='coaching'){
   await page.unroute('**/api/check**');let continued=false;
   await page.route('**/api/check-bottle',async route=>{const data=await new Request(route.request().url(),{method:'POST',headers:route.request().headers(),body:route.request().postDataBuffer()}).formData();assert.equal(data.get('checkAnyway'),'1');continued=true;await route.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({type:'retake',code:'test',message:'Free continuation test completed.'})+'\n'});});
   await page.getByRole('button',{name:'Check anyway',exact:true}).click();await page.getByText('Free continuation test completed.',{exact:true}).waitFor();assert(continued);
  }
  reports.push({name,width,errors,overflow:false,realPreparation,replay});await page.close();
 }
}finally{await browser.close();}
await fs.writeFile(out+'/browser-checks.json',JSON.stringify({base,scope:'Mocked synthetic consensus, actual free coaching endpoint, cached real user outcome; no paid browser calls.',reports},null,2));console.log(JSON.stringify(reports));

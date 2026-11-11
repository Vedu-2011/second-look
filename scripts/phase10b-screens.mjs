// Free UI replay of saved real readings. Every bottle API request is intercepted; no AI or quota calls.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(root+'/package.json');
const {chromium}=require('playwright-core');
const base=process.argv[2]||'http://localhost:3001';
const out=root+'/docs/screenshots/phase-10b';
const first=JSON.parse(await fs.readFile(root+'/docs/screenshots/phase-10b/real-before.json','utf8'));
const after=JSON.parse(await fs.readFile(root+'/docs/screenshots/phase-10b/real-after.json','utf8'));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const reports=[];
try {
 for (const width of [375,1440,1920]) {
  const page=await browser.newPage({viewport:{width,height:1080},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let next=first;
  await page.route('**/api/check-bottle',route=>route.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({type:'result',result:next,shareId:'00000000-0000-4000-8000-000000000000',continuationToken:'0'.repeat(64)})+'\n'}));
  async function upload(file){await page.locator('input[type=file]:not([capture])').setInputFiles(root+'/'+file);await page.locator('img[alt^="Your"]').first().waitFor();}
  await page.goto(base+'/check',{waitUntil:'networkidle'});
  await upload('test-images/real/bottle/label.jpg');
  await page.getByRole('button',{name:'Next: photo of the pills',exact:true}).click();
  await upload('test-images/real/bottle/pills.jpg');
  await page.getByRole('button',{name:'Check my pills',exact:true}).last().click();
  await page.locator('#bottle-verdict').waitFor();
  await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
  async function shot(name){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'/'+name+'-'+width+'.png',fullPage:true});await page.screenshot({path:out+'/'+name+'-hero-'+width+'.png'}); await page.getByRole('list',{name:'Marker legend'}).screenshot({path:out+'/'+name+'-legend-'+width+'.png'}); await page.getByRole('button',{name:/^Pill 5:/}).click(); const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,markers:document.querySelectorAll('button[aria-label^="Pill "]').length,focus:document.activeElement?.id,legendFits:[...document.querySelectorAll('[aria-label="Marker legend"] li')].every(e=>e.scrollWidth<=e.clientWidth)})); if(layout.overflow||errors.length||!layout.legendFits||layout.focus!=='bottle-pill-5')throw new Error(JSON.stringify(layout)); reports.push({width,state:name,errors:[...errors],...layout});}
  await shot('real-red');
  next=after;
  const button=page.locator('#bottle-verdict').locator('..').getByRole('button').first();
  await button.click();await upload('test-images/real/bottle/pills-flipped.jpg');await page.getByRole('button',{name:'Check again',exact:true}).click();
  await page.getByText(after.followUp.note,{exact:true}).waitFor();
  await shot('real-after-flip');await page.close();
 }
}finally{await browser.close();}
await fs.writeFile(out+'/browser-checks.json',JSON.stringify({base,note:'Actual cached live results replayed at API boundary; no new paid call.',reports},null,2));
console.log(JSON.stringify(reports,null,2));

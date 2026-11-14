import fs from 'node:fs/promises';import path from 'node:path';import{fileURLToPath}from'node:url';import{chromium}from'playwright-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=root+'/video/work';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const p=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
 await p.route('**/api/check**',r=>r.abort());
 await p.goto('https://getsecondlook.vercel.app/result/1537e0b0-9286-467d-84d2-9f2ff8425ff6',{waitUntil:'networkidle'});
 await p.locator('section[aria-labelledby="bottle-verdict"]').screenshot({path:out+'/after-flip-verdict.png'});
 await p.locator('#bottle-pill-5').screenshot({path:out+'/after-flip-pill.png'});
 await p.goto('https://getsecondlook.vercel.app/research',{waitUntil:'networkidle'});
 await p.locator('table').first().screenshot({path:out+'/research-table.png'});
 const heads=await p.getByRole('heading').allTextContents();console.log(JSON.stringify(heads));
 const h=p.getByRole('heading',{name:/safety bug|found.*fixed|before.*after/i}).first();
 if(await h.count()){await h.scrollIntoViewIfNeeded();await p.screenshot({path:out+'/safety-detail.png'});}else await p.screenshot({path:out+'/safety-detail.png'});
 const data=async f=>'data:image/png;base64,'+(await fs.readFile(f)).toString('base64');
 const template=await fs.readFile(out+'/diagram.html','utf8'),style=template.match(/<style>([\s\S]*?)<\/style>/)[1],brand=template.match(/<div class="brand">[\s\S]*?<\/div>/)[0];
 for(const [name,content]of[
 ['flip-proof',`<div class="left"><h1>Flip just<br>that pill.</h1><p class="sub"><b>93 / 2263</b><br>Amoxicillin 500 mg</p><p class="note">Previously recorded, FDA-backed<br>after-flip result.</p><span class="tag">Draft · flip recording pending</span></div><img style="position:absolute;left:940px;top:180px;width:840px;border-radius:28px;box-shadow:0 12px 35px #0001" src="${await data(out+'/after-flip-verdict.png')}"><img style="position:absolute;left:940px;top:580px;width:840px;max-height:295px;object-fit:contain;object-position:top left" src="${await data(out+'/after-flip-pill.png')}">`],
 ['research-proof',`<div class="main" style="top:180px"><h1 style="font-size:84px">Tested on 150 unseen NIH photos.</h1><p class="sub muted" style="font-size:32px;margin-top:25px">Historical first-version pill reader · every outcome published</p><img style="margin-top:70px;max-height:480px;width:1680px;object-fit:contain;object-position:left top" src="${await data(out+'/research-table.png')}"></div>`],
 ['softgel-limit',`<div class="left" style="top:235px"><h1>When we<br>can’t tell,<br>we say so.</h1><p class="sub">Shiny, see-through softgels<br>are still hard to read.</p><p class="note">Previously recorded real check.<br>Appearance alone is not confirmation.</p></div><img style="position:absolute;left:1050px;top:170px;width:620px;max-height:680px;object-fit:contain;object-position:top;border-radius:28px;box-shadow:0 12px 35px #0001" src="${await data(root+'/docs/screenshots/phase-11d/pile-result-pill9-375.png')}">`],
 ]){await p.setContent(`<!doctype html><html><head><style>${style}</style></head><body>${brand}${content}</body></html>`);await p.screenshot({path:out+'/'+name+'.png'});}
}finally{await browser.close();}

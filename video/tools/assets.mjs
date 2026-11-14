// All page evidence is captured from production. These GETs never run a photo check.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QRCodeSVG} from 'qrcode.react';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=root+'/video/work';
const logo='<svg viewBox="0 0 28 32"><rect x="3" y="1.5" width="22" height="7" rx="2.5" fill="#1D1D1F"/><rect x="5" y="7" width="18" height="23.5" rx="4.5" fill="#FF9500"/><rect x="8" y="14" width="12" height="10" rx="2" fill="white"/><path d="M10 17h6m-6 4h8" stroke="#1D1D1F" stroke-width="1.6" stroke-linecap="round"/></svg>';
const qr=renderToStaticMarkup(createElement(QRCodeSVG,{value:'https://getsecondlook.vercel.app',size:300,level:'M',marginSize:4}));
const css=`*{box-sizing:border-box}body{margin:0;width:1920px;height:1080px;background:#f5f5f7;color:#1d1d1f;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;overflow:hidden}.brand{position:absolute;top:64px;left:100px;display:flex;align-items:center;gap:20px;font-size:38px;font-weight:650;letter-spacing:-1.3px}.brand svg{width:40px;height:48px}h1,h2,p{margin:0}h1{font-size:100px;letter-spacing:-4px;line-height:1.03}h2{font-size:62px;letter-spacing:-2px;line-height:1.08}.main{position:absolute;left:120px;right:120px;top:230px}.number{font-size:190px;letter-spacing:-8px;font-weight:730}.muted{color:#6e6e73}.sub{font-size:42px;line-height:1.3;max-width:1400px;letter-spacing:-.7px}.citation{position:absolute;bottom:180px;left:120px;font-size:25px;color:#6e6e73;max-width:1600px;line-height:1.45}.flow{display:flex;align-items:center;gap:30px;margin-top:95px}.step{font-size:39px;font-weight:650;line-height:1.2;padding:32px 24px;background:white;border-radius:30px;min-height:150px;flex:1;display:flex;align-items:center;justify-content:center;text-align:center;box-shadow:0 12px 32px #0000000a}.arrow{font-size:42px;color:#6e6e73}.left{position:absolute;left:110px;top:280px;width:680px}.left h1{font-size:80px}.left .sub{font-size:35px;margin-top:32px;line-height:1.4}.note{margin-top:38px;font-size:26px;color:#6e6e73;line-height:1.4}.tag{display:inline-block;margin-top:25px;padding:12px 22px;background:#fff1d9;border-radius:32px;font-size:23px}.credit{position:absolute;bottom:110px;left:120px;font-size:28px;color:#6e6e73}`;
const brand=`<div class="brand">${logo}<span>Second Look</span></div>`;
const cards={
 stats1:`<div class="main"><div class="number">51.5 million</div><p class="sub">Estimated pharmacy dispensing errors<br>each year in the US.</p></div><p class="citation">Flynn et al. · Journal of the American Pharmacists Association, 2003<br>Observational estimate. Errors we can help catch, not errors prevented.</p>`,
 stats2:`<div class="main"><h2>When a refill looks different.</h2><div style="display:flex;gap:160px;margin-top:35px"><div><div class="number">34%</div><p class="sub">after a color change</p></div><div><div class="number">66%</div><p class="sub">after a shape change</p></div></div><p class="sub" style="margin-top:30px;font-size:35px">Higher odds of stopping heart medicine.</p></div><p class="citation">Kesselheim et al. · Annals of Internal Medicine, 2014<br>Association with nonpersistence after changes in pill appearance.</p>`,
 diagram:`<div class="main"><h1>AI reads.<br>Code decides.</h1><div class="flow"><div class="step">Label +<br>pills photo</div><span class="arrow">→</span><div class="step">Claude reads<br>print, color, shape</div><span class="arrow">→</span><div class="step">FDA + NLM<br>records</div><span class="arrow">→</span><div class="step">Code picks<br>the answer</div></div></div>`,
 bottle:`<div class="left"><h1>One bottle.<br>One wrong pill.</h1><p class="sub">The label says metformin.<br>The imprint says <b>93</b>.</p><p class="note">A mismatch stands even before<br>the other side is identified.</p><span class="tag">Draft · bottle take pending</span></div>`,
 flip:`<div class="left"><h1>Flip just<br>that pill.</h1><p class="sub"><b>93 / 2263</b><br>Amoxicillin 500 mg</p><p class="note">Previously recorded, FDA-backed<br>after-flip result. No new AI call.</p><span class="tag">Draft · flip recording pending</span></div>`,
 same:`<div class="left"><h1>Same medicine.<br>Different look.</h1><p class="sub">Advil label.<br>Store-brand softgel.</p><p class="note">Appearance is shared by several sellers.<br>The FDA records show the match.</p></div>`,
 end:`<div class="main" style="top:250px"><h1 style="font-size:115px">A ten-second<br>second look.</h1><p style="font-size:48px;margin-top:50px;letter-spacing:-1.5px">getsecondlook.vercel.app</p><p style="font-size:32px;color:#6e6e73;margin-top:45px">Not medical advice.<br>Always check with your pharmacist.</p></div><div style="position:absolute;right:160px;top:320px">${qr}</div>`,
};
try { await fs.access(root+'/video/raw/voiceover.mp3'); cards.end+='<p class="credit">Voiceover: elevenlabs.io</p>'; } catch { /* Local macOS voice: no ElevenLabs credit. */ }
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const report=[];
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 for(const [name,content]of Object.entries(cards)){
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>${brand}${content}</body></html>`);
  await page.screenshot({path:`${out}/${name}.png`});
  await fs.writeFile(`${out}/${name}.html`,`<!doctype html><html><head><style>${css}</style></head><body>${brand}${content}</body></html>`);
 }
 await page.close();
 for(const [name,url,term]of[
  ['home','https://getsecondlook.vercel.app',''],
  ['sources','https://getsecondlook.vercel.app/sources',''],
  ['research','https://getsecondlook.vercel.app/research','83'],
  ['safety','https://getsecondlook.vercel.app/research','safety bug'],
  ['after-flip','https://getsecondlook.vercel.app/result/1537e0b0-9286-467d-84d2-9f2ff8425ff6','Amoxicillin'],
 ]){
  const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,reducedMotion:'reduce',recordVideo:{dir:out+'/recordings',size:{width:1920,height:1080}}});
  const p=await context.newPage();await p.route('**/api/check**',r=>r.abort());await p.route('**/api/read-label**',r=>r.abort());
  const r=await p.goto(url,{waitUntil:'networkidle'});if(r.status()!==200)throw new Error(`${url} returned ${r.status()}`);
  await p.evaluate(()=>document.fonts.ready);
  const text=await p.locator('body').innerText();
  if(name==='research'&&(!text.includes('150')||!text.includes('83')||!text.includes('88')))throw new Error('Research claim numbers missing');
  if(term){const target=p.getByText(term,{exact:false}).first();if(await target.count())await target.scrollIntoViewIfNeeded();}
  if(name==='after-flip'&&!text.includes('Amoxicillin'))throw new Error('Genuine after-flip share unavailable; do not fabricate a result');
  await p.waitForTimeout(500);await p.screenshot({path:`${out}/${name}.png`});
  await p.waitForTimeout(5000);const video=p.video();await context.close();await video.saveAs(`${out}/${name}.webm`);
  report.push({name,url,status:r.status(),text,recording:name+'.webm',screenshot:name+'.png'});
 }
}finally{await browser.close();}
await fs.writeFile(out+'/production-captures.json',JSON.stringify({capturedAt:new Date().toISOString(),paidAiCalls:0,report},null,2)+'\n');
console.log(JSON.stringify(report.map(({name,status})=>({name,status}))));

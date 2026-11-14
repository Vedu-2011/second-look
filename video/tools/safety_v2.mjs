// Actual production safety note, enlarged without changing its words or the app.
import fs from'node:fs/promises';import{chromium}from'playwright-core';
const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{const p=await b.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});await p.route('**/api/check**',r=>r.abort());
await p.goto('https://getsecondlook.vercel.app/research',{waitUntil:'networkidle'});
const note=p.locator('li').filter({hasText:'The fresh test found a real safety bug'}).first();await note.screenshot({path:'video/work/v2/safety-note.png'});
const base=await fs.readFile('video/work/diagram.html','utf8'),style=base.match(/<style>([\s\S]*?)<\/style>/)[1],brand=base.match(/<div class="brand">[\s\S]*?<\/div>/)[0];
const data='data:image/png;base64,'+(await fs.readFile('video/work/v2/safety-note.png')).toString('base64');
await p.setContent(`<html><head><style>${style}</style></head><body>${brand}<div class="main"><h1>Testing caught<br>a real safety bug.</h1><img src="${data}" style="width:1640px;margin-top:90px;object-fit:contain"><p class="sub muted" style="font-size:32px;margin-top:55px">The frozen results and separate before/after audit are public.</p></div></body></html>`);
await p.screenshot({path:'video/work/v2/safety.png'});
}finally{await b.close();}

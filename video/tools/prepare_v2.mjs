// Reuse approved v1 templates, removing superseded draft/voice labels for the real footage.
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 for(const name of ['bottle','flip','end']) {
  let html=await fs.readFile(`video/work/${name}.html`,'utf8');
  html=html.replace(/<span class="tag">[\s\S]*?<\/span>/g,'').replace(/<p class="credit">[\s\S]*?<\/p>/g,'');
  if(name==='flip')html=html.replace('Previously recorded, FDA-backed<br>after-flip result. No new AI call.','Only the requested pill is read again.<br>Earlier readings stay marked as history.');
  await page.setContent(html);await page.screenshot({path:`video/work/v2/${name}.png`});
 }
} finally {await browser.close();}

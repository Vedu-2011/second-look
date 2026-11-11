import { chromium } from "playwright-core";
import { readFile, writeFile, copyFile } from "node:fs/promises";
import sharp from "sharp";
const base=process.argv[2]||"http://localhost:3217";
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",headless:true});
try {
 const page=await browser.newPage({viewport:{width:1200,height:630},reducedMotion:"reduce"});
 await page.goto(base+"/one-pager",{waitUntil:"networkidle"});
 await page.evaluate(async()=>{await document.fonts.ready;const el=document.querySelector('.social-export');el.style.cssText='display:flex;position:absolute;top:0;left:0;z-index:100';});
 await page.locator('.social-export').screenshot({path:'public/social-card.png',scale:'css',style:'.site-header {visibility:hidden!important}'});
 await copyFile('public/social-card.png','docs/screenshots/phase-8/after/open-graph.png');
} finally {await browser.close();}
const png=await sharp(await readFile('src/app/icon.svg')).resize(32,32).png().toBuffer();
const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header[6]=32;header[7]=32;header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);
await writeFile('src/app/favicon.ico',Buffer.concat([header,png]));

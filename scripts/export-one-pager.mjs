import { chromium } from "playwright-core";
import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const base = process.argv[2] || "http://localhost:3211";
const output = "docs/screenshots/phase-6";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless:true});
try {
  const page = await browser.newPage({viewport:{width:1000,height:1000},deviceScaleFactor:2,reducedMotion:"reduce"});
  await page.goto(base+"/samples/mismatch",{waitUntil:"networkidle"});
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('[data-verdict="MISMATCH"]').screenshot({path:"public/one-pager-result.png"});
  const panel=page.locator('figure').filter({has: page.locator('figcaption').filter({hasText:"What the FDA says it should look like"})}).first();
  await panel.locator('div').first().screenshot({path:"public/one-pager-pill.png"});
  await page.goto(base+"/one-pager",{waitUntil:"networkidle"});
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('.social-export').evaluate(el=>{el.style.display="flex";el.style.position="absolute";el.style.top="0";el.style.left="0";});
  await page.setViewportSize({width:1200,height:630});
  await page.locator('.social-export').screenshot({path:"public/social-card.png",scale:"css"});
  await copyFile("public/social-card.png",output+"/open-graph-1200x630.png");
  const printPage = await browser.newPage({viewport:{width:1000,height:1000},reducedMotion:"reduce"});
  await printPage.emulateMedia({media:"print"});
  await printPage.goto(base+"/one-pager",{waitUntil:"networkidle"});
  await printPage.evaluate(async()=>{
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('.one-pager img')].map(img=>img.decode()));
  });
  const height=await printPage.locator('.one-pager').evaluate(el=>el.getBoundingClientRect().height);
  if(height>960) throw Error("Print sheet exceeds 10 inch content height: "+height);
  await printPage.pdf({path:"public/second-look-one-pager.pdf",format:"Letter",printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false,tagged:true});
  await printPage.close();
  await copyFile("public/second-look-one-pager.pdf","docs/second-look-one-pager.pdf");
  console.log("Print content height",height,"CSS pixels; PDF exported to public/ and docs/.");
  await page.emulateMedia({media:"screen"});
  for(const width of [375,1440]) {
    await page.setViewportSize({width,height:1000});
    for(const route of ["research","one-pager"]) {
      await page.goto(base+"/"+route,{waitUntil:"networkidle"});
      await page.evaluate(()=>document.fonts.ready);
      if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw Error(route+" overflows at "+width);
      await page.screenshot({path:`${output}/${route}-${width}.png`,fullPage:true});
    }
  }
} finally {await browser.close();}
// Replace the starter favicon with a PNG-backed ICO of the same amber bottle.
const png=await sharp(await readFile("src/app/icon.svg")).resize(32,32).png().toBuffer();
const header=Buffer.alloc(22);
header.writeUInt16LE(1,2); header.writeUInt16LE(1,4);
header[6]=32;header[7]=32;header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);
header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);
await writeFile("src/app/favicon.ico",Buffer.concat([header,png]));

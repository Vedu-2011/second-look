import assert from "node:assert/strict";
import { copyFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://localhost:3211";
const output = process.env.ONE_PAGER_SCREENSHOTS_DIR || "docs/screenshots/phase-10";
const pdfPath = process.env.ONE_PAGER_PDF_PATH || "public/second-look-one-pager.pdf";
const picture = "public/one-pager-result.png";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});

try {
  // Use the real typed FDA check, so the image stays two drawings even if
  // real photos are added to the sample replay later. No model calls.
  const page = await browser.newPage({viewport:{width:1440,height:2400},deviceScaleFactor:2,reducedMotion:"reduce"});
  await page.goto(base + "/type", {waitUntil:"networkidle"});
  // The final demo: metformin label, amoxicillin 93 / 2263 look-alike (phase 8 addendum 3).
  await page.getByRole("textbox", {name:/NDC on the label/}).fill("70010-065");
  await page.getByRole("textbox", {name:/Imprint on one side/}).fill("93");
  await page.getByRole("textbox", {name:/Other side/}).fill("2263");
  await page.getByRole("button", {name:"White",exact:true}).click();
  await page.getByRole("button", {name:"Oval",exact:true}).click();
  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith("/api/verify")),
    page.getByRole("button", {name:"Check my pill",exact:true}).click(),
  ]);
  assert.equal(response.status(), 200);
  const checked = await response.json();
  assert.equal(checked.verdict, "MISMATCH");
  assert.match(checked.identifiedAs?.title, /Amoxicillin 500 mg/i);
  const result = page.getByRole("article", {name:"Check result"});
  const verdict = result.locator('[data-verdict="MISMATCH"]');
  const cards = result.locator(":scope > div").filter({has:page.getByText("What the FDA says it should look like", {exact:true})}).first();
  await cards.getByText("What's in your bottle", {exact:true}).waitFor();
  const drawings = cards.locator("svg[role=img]");
  assert.match(await drawings.nth(0).getAttribute("aria-label"), /G/);
  assert.match(await drawings.nth(1).getAttribute("aria-label"), /93/);
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
  const top = await verdict.boundingBox();
  const bottom = await cards.boundingBox();
  assert(top && bottom);
  const x = Math.floor(Math.min(top.x, bottom.x)) - 10;
  const y = Math.floor(top.y) - 8;
  const width = Math.ceil(Math.max(top.x + top.width, bottom.x + bottom.width)) - x + 10;
  const height = Math.ceil(bottom.y + bottom.height) - y + 10;
  assert(height + y <= 2400, "the full result crop must fit in the viewport");
  await page.screenshot({path:picture, clip:{x,y,width,height}});

  const printPage = await browser.newPage({viewport:{width:739,height:979},reducedMotion:"reduce"});
  await printPage.emulateMedia({media:"print"});
  await printPage.goto(base + "/one-pager", {waitUntil:"networkidle"});
  await printPage.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll(".one-pager img")].map(img => img.decode()));
  });
  const size = await printPage.locator(".one-pager").boundingBox();
  assert(size && size.height <= 979, `Print content exceeds Letter margins: ${size?.height}px`);
  await printPage.pdf({path:pdfPath,format:"Letter",printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false,tagged:true});
  if (!process.env.ONE_PAGER_PDF_PATH) await copyFile(pdfPath, "docs/second-look-one-pager.pdf");
  console.log(`Screenshot ${width} × ${height} CSS px; print content ${size.height.toFixed(1)} px.`);

  for (const width of [375, 1440]) {
    await page.setViewportSize({width,height:1000});
    await page.goto(base + "/one-pager", {waitUntil:"networkidle"});
    await page.evaluate(() => document.fonts.ready);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `One-pager overflows at ${width}px`);
    await page.screenshot({path:`${output}/one-pager-${width}.png`,fullPage:true});
  }
} finally {
  await browser.close();
}

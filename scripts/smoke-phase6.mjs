import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:3211";
const livePhoto = process.argv.includes("--live-photo");
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless:true});
const page = await browser.newPage({viewport:{width:375,height:812},reducedMotion:"reduce"});
const errors = [];
page.on("pageerror", e=>errors.push(e.message));
let photoPosts=0;
// The audit is free unless explicitly opted into one photo check.
await page.route("**/api/check", async route=>{
  photoPosts++;
  if(!livePhoto || photoPosts>1) await route.abort();
  else await route.continue();
});
const timing = () => { const start=performance.now(); return ()=>Math.round(performance.now()-start); };
const visit = async route => {
  const res=await page.goto(base+route,{waitUntil:"networkidle"});
  assert.equal(res.status(),200,route);
  assert(await page.title(),route+" title");
  assert(await page.locator('meta[name="description"]').getAttribute("content"));
  assert.equal(await page.locator('meta[property="og:image:width"]').getAttribute("content"),"1200");
  assert.equal(await page.locator('meta[property="og:image:height"]').getAttribute("content"),"630");
  assert(await page.locator('link[rel="icon"]').count());
  assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),route+" overflows at 375px");
};
try {
  for(const route of ["/","/check","/type","/samples","/research","/one-pager"]) {
    await visit(route);
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(":focus").textContent(),"Skip to content");
    await page.keyboard.press("Tab");
    assert.match(await page.locator(":focus").textContent(),/Second Look/);
  }
  const notFound=await page.goto(base+"/not-a-real-page-phase-6");
  assert.equal(notFound.status(),404);
  await page.getByRole("heading",{name:"We couldn’t find that page."}).waitFor();
  await visit("/");
  const sampleMs=timing();
  await page.getByRole("link",{name:"Run the sample check"}).click();
  await page.locator('[data-verdict="MATCH"][aria-label]').waitFor();
  await page.getByText(/no photos|saved FDA example|recorded FDA example/i).first().waitFor();
  assert.equal(photoPosts,0,"the empty-photo fallback must not call AI");
  console.log(JSON.stringify({check:"home → sample live entry → recorded FDA fallback",verdict:"MATCH",elapsedMs:sampleMs(),photoPosts}));
  await visit("/type");
  await page.getByRole("textbox",{name:/NDC on the label/}).fill("0113-0517");
  await page.getByRole("textbox",{name:/Imprint on one side/}).fill("I2");
  await page.getByRole("button",{name:"Orange",exact:true}).click();
  await page.getByRole("button",{name:"Oval",exact:true}).click();
  const typed=async verdict=>{
    const elapsed=timing();
    const [res]=await Promise.all([page.waitForResponse(r=>r.url().endsWith("/api/verify")),page.getByRole("button",{name:"Check my pill",exact:true}).click()]);
    assert.equal(res.status(),200);
    const body=await res.json();
    assert.equal(body.verdict,verdict);
    await page.locator(`[data-verdict="${verdict}"][aria-label]`).waitFor();
    console.log(JSON.stringify({check:"/type",verdict,identifiedAs:body.identifiedAs?.title,timings:body.timings,elapsedMs:elapsed()}));
  };
  await typed("MATCH");
  await page.getByRole("textbox",{name:/Imprint on one side/}).fill("L484");
  await page.getByRole("button",{name:"Orange",exact:true}).click();
  await page.getByRole("button",{name:"White",exact:true}).click();
  await typed("MISMATCH");
  if(livePhoto) {
    await visit("/check");
    const upload=page.locator('input[type="file"]:not([capture])');
    await upload.setInputFiles("test-images/labels/rendered/match.png");
    await page.getByRole("button",{name:"Next: photo of one pill"}).click();
    await upload.setInputFiles("test-images/pills/strattera-10mg-1.jpg");
    const elapsed=timing();
    const [res]=await Promise.all([page.waitForResponse(r=>r.url().endsWith("/api/check"),{timeout:65_000}),page.getByRole("button",{name:"Check my pill",exact:true}).click()]);
    const events=(await res.text()).trim().split("\n").map(line=>JSON.parse(line));
    const last=events.at(-1);
    console.log(JSON.stringify({check:"/check NIH live photo",photoPosts,http:res.status(),vercelId:res.headers()["x-vercel-id"],terminal:last.type,verdict:last.result?.verdict,timings:last.timings,elapsedMs:elapsed(),imprint:events.find(e=>e.type==="reading"&&e.kind==="pill")?.value?.imprintSides,progress:events.filter(e=>e.type==="step").map(e=>[e.step,e.state]),reason:last.type==="result"?undefined:last.reason??last.message}));
    assert.equal(photoPosts,1);
    assert.equal(res.status(),200);
    assert.equal(last.type,"result","no second paid request is attempted");
    assert.equal(last.result.verdict,"MISMATCH");
    await page.locator('[data-verdict="MISMATCH"][aria-label]').waitFor();
    const shared=await page.request.get(base+"/result/"+last.result.shareId);
    assert.equal(shared.status(),200);
    assert.match(await shared.text(),/data-verdict="MISMATCH"/);
    console.log("Saved result: HTTP 200, MISMATCH");
  }
  assert.deepEqual(errors,[],"browser runtime errors");
} finally { await browser.close(); }

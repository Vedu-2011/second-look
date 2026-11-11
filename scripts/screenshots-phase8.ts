import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { SAMPLE_RESULTS, sampleResult } from "../src/lib/sample-results";
const base = process.argv[2] ?? "http://localhost:3215";
const phase = process.argv[3] ?? "before";
if (!["before", "after"].includes(phase)) throw Error("Choose before or after.");
const output = `docs/screenshots/phase-8/${phase}`;
async function main() {
await mkdir(output, {recursive:true});
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",headless:true});
try {
  const page = await browser.newPage({reducedMotion:"reduce",deviceScaleFactor:1});
  await page.route("**/api/check", r=>r.abort()); // never pays for a reading
  const errors:string[]=[];
  page.on("pageerror", e=>errors.push(e.message));
  for (const width of [375,1440]) {
    await page.setViewportSize({width,height:1000});
    for (const route of ["/","/check","/type","/samples","/samples/match","/samples/different-maker","/samples/mismatch","/sources","/research","/labels","/one-pager","/style","/missing-page"]) {
      const response=await page.goto(base+route,{waitUntil:"networkidle"});
      if(!response || (response.status()!==200 && route!=="/missing-page")) throw Error(route+" returned "+response?.status());
      await page.evaluate(()=>document.fonts.ready);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
      if(overflow) throw Error(`${route} overflows at ${width}px`);
      await page.screenshot({path:`${output}/${route==="/"?"home":route.slice(1).replaceAll("/","-")}-${width}.png`,fullPage:true});
    }
    const variants=[...SAMPLE_RESULTS, {scenario:{id:"unsure"},result:sampleResult({...SAMPLE_RESULTS[0].scenario,pill:{...SAMPLE_RESULTS[0].scenario.pill,imprintConfidence:.4}})}];
    for(const {scenario,result} of variants) {
      await page.route("**/api/verify",r=>r.fulfill({json:result}));
      await page.goto(base+"/type",{waitUntil:"networkidle"});
      await page.getByRole("textbox",{name:/NDC on the label/}).fill("0113-0517");
      await page.getByRole("textbox",{name:/Imprint on one side/}).fill("I2");
      await page.getByRole("button",{name:"Orange",exact:true}).click();
      await page.getByRole("button",{name:"Oval",exact:true}).click();
      await page.getByRole("button",{name:"Check my pill",exact:true}).click();
      const verdict=page.locator(`[data-verdict="${result.verdict}"]`);
      await verdict.waitFor();
      await page.evaluate(()=>document.fonts.ready);
      const article=page.getByRole("article",{name:"Check result"});
      await article.screenshot({path:`${output}/result-${scenario.id}-${width}.png`, style: ".site-header { visibility: hidden !important; }"});
      await page.unroute("**/api/verify");
    }
  }
  if(errors.length) throw Error(errors.join("\n"));
  console.log(`Saved 34 ${phase} screenshots; no page errors or overflow. Results use network-free computed FDA fixtures, not live AI.`);
} finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});

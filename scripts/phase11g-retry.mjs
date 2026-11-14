// Phase 11g: the real /check UI when a bottle check fails on our side. No paid calls: /api/check-bottle is answered
// in the browser (a dropped upload, a cut-off stream, a retake) and a saved real result stands in for success.
// Usage: node scripts/phase11g-retry.mjs [base url]   (dev server running)
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright-core";
const root = fileURLToPath(new URL("../", import.meta.url)), out = root + "docs/screenshots/phase-11g";
const base = process.argv[2] || "http://localhost:3000";
const saved = JSON.parse(await fs.readFile(root + "test-images/bottle/generated/phase10b-after.json", "utf8"));
const result = saved.result ?? saved;
const ok = JSON.stringify({type: "result", result, shareId: "00000000-0000-4000-8000-000000000000", continuationToken: "0".repeat(64)}) + "\n";
const cutShort = JSON.stringify({type: "step", step: 1, state: "working"}) + "\n";
const retake = JSON.stringify({type: "retake", code: "too_many", message: "We found 25 objects, more than the 20-pill limit."}) + "\n";
const ndjson = body => ({contentType: "application/x-ndjson", body});
// Each scenario: what each request gets, in order.
const scenarios = [
  {name: "dropped-once", replies: ["abort", "ok-slow"], expect: "result", requests: 2},
  {name: "cut-short-once", replies: [ndjson(cutShort), "ok"], expect: "result", requests: 2},
  {name: "fails-twice", replies: ["abort", "abort", "ok"], expect: "try-again", requests: 3},
  {name: "photo-problem", replies: [ndjson(retake)], expect: "retake", requests: 1},
];
await fs.mkdir(out, {recursive: true});
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true});
try {
  for (const width of [375, 1440]) for (const s of scenarios) {
    const page = await browser.newPage({viewport: {width, height: 1000}, reducedMotion: "reduce"});
    const bodies = [], beacons = [];
    await page.route("**/api/client-error", async route => { beacons.push(JSON.parse(route.request().postData() || "{}")); await route.fulfill({status: 204}); });
    await page.route("**/api/check-bottle", async route => {
      bodies.push(route.request().postDataBuffer());
      const reply = s.replies[bodies.length - 1];
      if (reply === "abort") return route.abort("failed");
      if (reply === "ok-slow") { await new Promise(r => setTimeout(r, 2500)); return route.fulfill(ndjson(ok)); }
      if (reply === "ok") return route.fulfill(ndjson(ok));
      return route.fulfill(reply);
    });
    await page.goto(base + "/check", {waitUntil: "networkidle"});
    const upload = async file => { await page.locator("input[type=file]:not([capture])").setInputFiles(root + file); await page.locator("img[alt^='Your']").first().waitFor(); };
    await upload("test-images/real/bottle/label.jpg");
    await page.getByRole("button", {name: "Next: photo of the pills", exact: true}).click();
    await upload("test-images/real/bottle/pills.jpg");
    await page.getByRole("button", {name: "Check my pills", exact: true}).last().click();
    if (s.name === "dropped-once") {
      await page.getByText("That took too long on our side — trying again…").waitFor();
      await page.addStyleTag({content: "nextjs-portal{display:none!important}"});
      await page.screenshot({path: `${out}/retrying-${width}.png`, fullPage: true});
    }
    if (s.expect === "result") await page.locator("#bottle-verdict").waitFor();
    if (s.expect === "try-again") {
      await page.getByRole("button", {name: "Try again", exact: true}).waitFor();
      assert.equal(await page.getByRole("button", {name: "Retake pills photo"}).count(), 0, "no camera for a failure on our side");
      await page.getByText("Your photos are still here").waitFor();
      await page.addStyleTag({content: "nextjs-portal{display:none!important}"});
      await page.screenshot({path: `${out}/try-again-${width}.png`, fullPage: true});
      await page.getByRole("button", {name: "Try again", exact: true}).click();
      await page.locator("#bottle-verdict").waitFor();
    }
    if (s.expect === "retake") {
      await page.getByRole("button", {name: "Retake pills photo"}).waitFor();
      assert.equal(await page.getByRole("button", {name: "Try again", exact: true}).count(), 0);
      await page.waitForTimeout(2000);
    }
    assert.equal(bodies.length, s.requests, `${s.name}: requests`);
    // Every retry sends exactly the same photos (byte for byte, except the multipart boundary).
    const strip = b => b.toString("latin1").replace(/-{2,}[\w-]+/g, "");
    for (const b of bodies.slice(1)) assert.equal(strip(b), strip(bodies[0]), `${s.name}: retry must resend the same photos`);
    const expectedBeacons = s.name === "photo-problem" ? 0 : s.requests - 1;
    assert.equal(beacons.length, expectedBeacons, `${s.name}: beacons`);
    console.log("ok", width, s.name, `requests=${bodies.length}`, `beacons=${JSON.stringify(beacons.map(b => b.why))}`);
    await page.close();
  }
} finally { await browser.close(); }

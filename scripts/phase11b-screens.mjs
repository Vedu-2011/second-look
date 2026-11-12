// Phase 11b screenshots, no paid calls. Real metformin bottle: saved real results (phase 10b) replayed at the API
// boundary, so the real UI shows the new wording. User test: the real free coaching step from the reverted segmenter;
// we stop at "Retake / Check anyway" because reading the two newly numbered pills would be paid.
// Usage: node scripts/phase11b-screens.mjs [base url]   (dev server running)
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright-core";
const root = fileURLToPath(new URL("../", import.meta.url)), out = root + "docs/screenshots/phase-11b";
const base = process.argv[2] || "http://localhost:3000";
const saved = async name => { const r = JSON.parse(await fs.readFile(root + `test-images/bottle/generated/phase10b-${name}.json`, "utf8")); return r.result ?? r; };
const scenes = [
  {name: "metformin-before", label: "test-images/real/bottle/label.jpg", photo: "test-images/real/bottle/pills.jpg", result: await saved("before"), expect: "Its print says 93 — that's not on any metformin 1,000 mg."},
  {name: "metformin-after", label: "test-images/real/bottle/label.jpg", photo: "test-images/real/bottle/pills-flipped.jpg", result: await saved("after"), expect: "Its print says 93 / 2263 — that's Amoxicillin 500 mg, not your Metformin."},
  {name: "user-test-coaching", label: "test-images/real/different-maker/label.jpg", photo: "test-images/real/extra/user-test-ibuprofen-tylenol.jpg", expect: "Spread them out so none touch."},
];
await fs.mkdir(out, {recursive: true});
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true});
try {
  for (const width of [375, 1440]) for (const s of scenes) {
    const page = await browser.newPage({viewport: {width, height: 1000}, reducedMotion: "reduce"});
    let realCalls = 0;
    await page.route("**/api/check**", async route => {
      if (!s.result) { realCalls++; assert.equal(realCalls, 1, "only the free preparation request may reach the server"); await route.continue(); return; }
      await route.fulfill({contentType: "application/x-ndjson", body: JSON.stringify({type: "result", result: s.result, shareId: "00000000-0000-4000-8000-000000000000", continuationToken: "0".repeat(64)}) + "\n"});
    });
    await page.goto(base + "/check", {waitUntil: "networkidle"});
    const upload = async file => { await page.locator("input[type=file]:not([capture])").setInputFiles(root + file); await page.locator("img[alt^='Your']").first().waitFor(); };
    await upload(s.label);
    await page.getByRole("button", {name: "Next: photo of the pills", exact: true}).click();
    await upload(s.photo);
    await page.getByRole("button", {name: "Check my pills", exact: true}).last().click();
    if (s.result) {
      await page.locator("#bottle-verdict").waitFor();
      await page.locator("[data-pill-number='5']").first().click().catch(() => {});
      const row = page.locator("#bottle-pill-5");
      await row.getByText(s.expect, {exact: true}).waitFor();
      // The print comes first; "different from the others" after it.
      const text = await row.innerText();
      assert(text.indexOf("Its print says") < text.indexOf("from the others"), "print line must lead");
    } else {
      await page.getByRole("region", {name: "Photo tips before reading"}).getByText(s.expect).waitFor();
      await page.getByRole("button", {name: "Retake", exact: true}).waitFor();
    }
    await page.addStyleTag({content: "nextjs-portal{display:none!important}"});
    await page.screenshot({path: `${out}/${s.name}-${width}.png`, fullPage: true});
    if (s.result) await page.locator("#bottle-pill-5").screenshot({path: `${out}/${s.name}-pill5-${width}.png`});
    console.log("ok", s.name, width);
    await page.close();
  }
} finally { await browser.close(); }

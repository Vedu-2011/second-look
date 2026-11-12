// Phase 11c screenshots, no paid calls: the saved REAL phase 11c results (test-images/bottle/generated/phase11c-*.json,
// from `npm run smoke:piles -- --live`) replayed at the API boundary into the real /check UI.
// Usage: node scripts/phase11c-screens.mjs [base url]   (dev server running)
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright-core";
const root = fileURLToPath(new URL("../", import.meta.url)), out = root + "docs/screenshots/phase-11c";
const base = process.argv[2] || "http://localhost:3000";
const saved = async name => JSON.parse(await fs.readFile(root + `test-images/bottle/generated/phase11c-${name}.json`, "utf8"));
const scenes = [
  {name: "pile-result", label: "test-images/real/different-maker/label.jpg", photo: "test-images/real/extra/user-test-ibuprofen-tylenol.jpg", result: await saved("pile")},
  {name: "red-mode-metformin", label: "test-images/real/bottle/label.jpg", photo: "test-images/real/bottle/pills.jpg", result: await saved("metformin")},
];
await fs.mkdir(out, {recursive: true});
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true});
try {
  for (const width of [375, 1440]) for (const s of scenes) {
    const page = await browser.newPage({viewport: {width, height: 1000}, reducedMotion: "reduce"});
    await page.route("**/api/check**", route => route.fulfill({contentType: "application/x-ndjson", body: JSON.stringify({type: "result", result: s.result, shareId: "00000000-0000-4000-8000-000000000000", continuationToken: "0".repeat(64)}) + "\n"}));
    await page.goto(base + "/check", {waitUntil: "networkidle"});
    const upload = async file => { await page.locator("input[type=file]:not([capture])").setInputFiles(root + file); await page.locator("img[alt^='Your']").first().waitFor(); };
    await upload(s.label);
    await page.getByRole("button", {name: "Next: photo of the pills", exact: true}).click();
    await upload(s.photo);
    await page.getByRole("button", {name: "Check my pills", exact: true}).last().click();
    await page.locator("#bottle-verdict").waitFor();
    await page.waitForTimeout(300);
    // Pins: none overlap, none sit on a pill (measured in the real layout).
    const geo = await page.evaluate(() => {
      const o = document.querySelector("[data-bottle-overlay]").getBoundingClientRect();
      const pins = [...document.querySelectorAll("[data-pill-number]")].map(b => { const r = b.getBoundingClientRect(); return {x: r.x + r.width / 2 - o.x, y: r.y + r.height / 2 - o.y, w: r.width, m: b.dataset.marker}; });
      return {pins, w: o.width, h: o.height};
    });
    const full = geo.pins.filter(p => !p.m.startsWith("dim"));
    for (let i = 0; i < full.length; i++) for (let j = i + 1; j < full.length; j++) assert(Math.hypot(full[i].x - full[j].x, full[i].y - full[j].y) >= full[i].w - 0.5, `pins ${i} and ${j} overlap`);
    for (const p of full) for (const pill of s.result.pills) { const b = pill.box; assert(!(p.x > b.x * geo.w && p.x < (b.x + b.width) * geo.w && p.y > b.y * geo.h && p.y < (b.y + b.height) * geo.h), "pin on a pill"); }
    const red = s.result.pills.some(p => p.result.verdict === "MISMATCH");
    if (red) {
      await page.getByText(/^The other \d+ pills?: /).waitFor();
      assert.equal(await page.locator("details[data-pill-group='others']").getAttribute("open"), null, "others collapsed");
    }
    const legend = await page.getByRole("list", {name: "Marker legend"}).innerText();
    if ((s.result.clumps ?? []).some(c => !c.pile && !c.minor)) assert(legend.includes("Not read"), "legend lists Not read");
    await page.addStyleTag({content: "nextjs-portal{display:none!important}"});
    await page.screenshot({path: `${out}/${s.name}-${width}.png`, fullPage: true});
    await page.locator("[data-bottle-overlay]").screenshot({path: `${out}/${s.name}-photo-${width}.png`});
    console.log("ok", s.name, width, `${full.length} pins`, legend.replaceAll("\n", " | "));
    await page.close();
  }
} finally { await browser.close(); }

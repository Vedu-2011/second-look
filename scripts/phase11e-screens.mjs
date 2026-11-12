// Phase 11e screenshots + assertions, no paid calls. Real saved results replayed into the real /check UI, plus
// Vedhanth's real stored phone check on its share page (no photo is ever stored, so it shows pill shapes).
// Usage: node scripts/phase11e-screens.mjs [base url] [share id]   (dev server running)
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright-core";
const root = fileURLToPath(new URL("../", import.meta.url)), out = root + "docs/screenshots/phase-11e";
const base = process.argv[2] || "http://localhost:3000", shareId = process.argv[3] || "2cb7590c-1df9-4c3a-9f8c-ce690c0e10cd";
const saved = async name => JSON.parse(await fs.readFile(root + `test-images/bottle/generated/${name}.json`, "utf8"));
const vedhanth = (await saved("phase11e-vedhanth")).result;
const scenes = [
  {name: "pile-result", label: "test-images/real/different-maker/label.jpg", photo: "test-images/real/extra/user-test-ibuprofen-tylenol.jpg", result: await saved("phase11d-pile")},
  {name: "red-mode-metformin", label: "test-images/real/bottle/label.jpg", photo: "test-images/real/bottle/pills.jpg", result: await saved("phase11d-metformin")},
  {name: "crowded-pile-share-vedhanth", share: shareId, result: vedhanth},
];
// Same geometry as src/lib/bottle/overlay.ts (pillShape + capsuleDistance), in overlay pixels.
const shape = (p, W, H) => p.outline ? {cx: p.outline.cx * W, cy: p.outline.cy * H, angle: p.outline.angle, length: Math.max(p.outline.length, p.outline.width) * W, width: Math.min(p.outline.length, p.outline.width) * W}
  : (() => { const w = p.box.width * W, h = p.box.height * H; return {cx: (p.box.x + p.box.width / 2) * W, cy: (p.box.y + p.box.height / 2) * H, angle: w >= h ? 0 : Math.PI / 2, length: Math.max(w, h), width: Math.min(w, h)}; })();
const dist = (pt, s) => { const half = Math.max(0, (s.length - s.width) / 2), ux = Math.cos(s.angle), uy = Math.sin(s.angle), dx = pt.x - s.cx, dy = pt.y - s.cy, t = Math.max(-half, Math.min(half, dx * ux + dy * uy)); return Math.hypot(dx - t * ux, dy - t * uy) - s.width / 2; };
await fs.mkdir(out, {recursive: true});
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true});
try {
  for (const width of [375, 1440]) for (const s of scenes) {
    const page = await browser.newPage({viewport: {width, height: 1000}, reducedMotion: "reduce"});
    if (s.share) await page.goto(`${base}/result/${s.share}`, {waitUntil: "networkidle"});
    else {
      await page.route("**/api/check**", route => route.fulfill({contentType: "application/x-ndjson", body: JSON.stringify({type: "result", result: s.result, shareId: "00000000-0000-4000-8000-000000000000", continuationToken: "0".repeat(64)}) + "\n"}));
      await page.goto(base + "/check", {waitUntil: "networkidle"});
      const upload = async file => { await page.locator("input[type=file]:not([capture])").setInputFiles(root + file); await page.locator("img[alt^='Your']").first().waitFor(); };
      await upload(s.label);
      await page.getByRole("button", {name: "Next: photo of the pills", exact: true}).click();
      await upload(s.photo);
      await page.getByRole("button", {name: "Check my pills", exact: true}).last().click();
    }
    await page.locator("#bottle-verdict").waitFor();
    await page.waitForTimeout(400);
    const geo = await page.evaluate(() => {
      const o = document.querySelector("[data-bottle-overlay]").getBoundingClientRect();
      const chips = [...document.querySelectorAll("[data-chip]")].map(b => { const r = b.getBoundingClientRect(); return {n: Number(b.dataset.pillNumber), x: r.x + r.width / 2 - o.x, y: r.y + r.height / 2 - o.y, r: r.width / 2}; });
      return {W: o.width, H: o.height, ox: o.x, oy: o.y, chips};
    });
    await page.addStyleTag({content: "nextjs-portal{display:none!important}"});
    await page.screenshot({path: `${out}/${s.name}-${width}.png`, fullPage: true});
    await page.locator("[data-bottle-overlay]").screenshot({path: `${out}/${s.name}-photo-${width}.png`});
    const pills = s.result.pills, shapes = pills.map(p => shape(p, geo.W, geo.H));
    // Every chip's nearest pill is its own pill.
    for (const c of geo.chips) {
      const own = pills.findIndex(p => p.number === c.n), d = shapes.map(sh => dist(c, sh));
      for (const [j, v] of d.entries()) if (j !== own) assert(v > d[own], `chip ${c.n} is as close to pill ${pills[j].number} as to its own`);
    }
    // The wrong pill's ring encloses the wrong pill's center (hit-test at that point finds its red ring).
    for (const p of pills.filter(p => p.result.verdict === "MISMATCH")) {
      const sh = shapes[pills.indexOf(p)];
      const hit = await page.evaluate(([x, y, n]) => {
        const o = document.querySelector("[data-bottle-overlay]"); o.scrollIntoView({block: "center"});
        const r = o.getBoundingClientRect();
        return document.elementsFromPoint(r.x + x, r.y + y).some(e => e.dataset?.pillRing === String(n) && e.dataset.marker === "mismatch");
      }, [sh.cx, sh.cy, p.number]);
      assert(hit, `red ring must enclose pill ${p.number}'s center`);
    }
    const red = pills.some(p => p.result.verdict === "MISMATCH");
    if (red) assert(geo.chips.every(c => pills.find(p => p.number === c.n).result.verdict === "MISMATCH"), "red mode: only the wrong pill has a chip");
    console.log("ok", s.name, width, `${geo.chips.length} chips`, `${await page.locator("[data-pill-ring]").count()} rings`);
    await page.close();
  }
} finally { await browser.close(); }

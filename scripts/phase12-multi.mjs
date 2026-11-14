// Phase 12: the real /check UI with more than one label photo and more than one photo of pills. No paid calls:
// /api/read-label and /api/check-bottle are answered in the browser. Saved real results stand in for checks: photo 1
// is the real metformin result with the "93" taken out (display test data only), photo 2 is the real red result
// (both drawn on the same real photo, so the rings line up).
// Usage: node scripts/phase12-multi.mjs [base url]   (dev server running)
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright-core";
const root = fileURLToPath(new URL("../", import.meta.url)), out = root + "docs/screenshots/phase-12";
const base = process.argv[2] || "http://localhost:3000";
const red = JSON.parse(await fs.readFile(root + "test-images/bottle/generated/phase10b-before.json", "utf8"));
const green = structuredClone(red);
green.pills = green.pills.filter(p => p.result.verdict !== "MISMATCH").map((p, i) => ({...p, number: i + 1, result: {...p.result, verdict: "MATCH"}}));
green.decision = {verdict: "MATCH", title: `All ${green.pills.length} pills we found match your label.`, instruction: "Check that every pill in your photo has a number. We only checked the pills we found.", matched: green.pills.length, unreadable: 0, flagged: []};
const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222", TOKEN = "c".repeat(64);
const front = {drugName: "Metformin HCl", strength: "1,000 mg", ndc: null, isPrescriptionLabel: true};
const whole = {...front, ndc: "70010-065"};
const ndjson = obj => ({contentType: "application/x-ndjson", body: JSON.stringify(obj) + "\n"});
const shot = (page, name) => page.addStyleTag({content: "nextjs-portal{display:none!important}"}).then(() => page.screenshot({path: `${out}/${name}.png`, fullPage: true}));
await fs.mkdir(out, {recursive: true});
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true});

async function open(width, labelReplies) {
  const page = await browser.newPage({viewport: {width, height: 1000}, reducedMotion: "reduce"});
  const labelForms = [], checks = [];
  page.on("pageerror", e => console.log("page error:", e.message));
  page.on("console", m => m.type() === "error" && console.log("console error:", m.text().slice(0, 300)));
  await page.route("**/api/client-error", r => r.fulfill({status: 204}));
  await page.route("**/api/read-label", async route => {
    labelForms.push(route.request().postDataBuffer().toString("latin1"));
    const reply = labelReplies[labelForms.length - 1];
    if (reply === "abort") return route.abort("failed");
    await new Promise(r => setTimeout(r, 300));
    return route.fulfill({contentType: "application/json", body: JSON.stringify(reply)});
  });
  await page.goto(base + "/check", {waitUntil: "networkidle"});
  // Every photo goes through a real button and file chooser, the way a person adds it.
  const choose = async (button, file) => {
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", {name: button, exact: true}).click()]);
    await chooser.setFiles(root + file);
    await page.getByText("Preparing your photo at full resolution…").waitFor({state: "detached"});
    await page.locator("img[alt^='Your']").first().waitFor();
  };
  return {page, labelForms, checks, choose};
}
const field = (form, name) => form.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`))?.[1];

try {
  for (const width of [375, 1440]) {
    // 1. Two label photos, then two photos of pills; photo 2 has the wrong pill → the bottle is red.
    const s = await open(width, [
      {labelId: A, labelToken: TOKEN, photos: 1, label: front, conflicts: [], missing: ["ndc"]},
      {labelId: A, photos: 2, label: whole, conflicts: [], missing: []},
    ]);
    const {page} = s;
    await page.route("**/api/check-bottle", async route => {
      const form = route.request().postDataBuffer().toString("latin1"); s.checks.push(form);
      if (s.checks.length === 1) return route.fulfill(ndjson({type: "result", result: green, shareId: A, continuationToken: TOKEN}));
      return route.fulfill(ndjson({type: "result", result: {...red, photos: [A]}, shareId: B, continuationToken: TOKEN}));
    });
    await s.choose("Upload a photo", "test-images/real/bottle/label.jpg");
    await page.getByText("We couldn't read the whole label — turn the bottle and take another photo.").waitFor();
    await page.getByText("We read: Metformin HCl 1,000 mg").waitFor();
    await shot(page, `label-one-${width}`);
    await s.choose("Upload another", "test-images/real/bottle/label.jpg");
    await page.getByText("We read: Metformin HCl 1,000 mg · NDC 70010-065").waitFor();
    await page.getByText("From 2 photos of the label.").waitFor();
    assert.equal(await page.getByText("We couldn't read the whole label").count(), 0);
    assert.equal(field(s.labelForms[1], "labelId"), A, "the second photo is added to the same label");
    await shot(page, `label-two-${width}`);
    await page.getByRole("button", {name: "Next: photo of the pills", exact: true}).click();
    await s.choose("Upload a photo", "test-images/real/bottle/pills.jpg");
    await page.getByRole("button", {name: "Check my pills", exact: true}).last().click();
    await page.locator("#bottle-verdict").waitFor();
    assert.equal(field(s.checks[0], "labelId"), A); assert.equal(field(s.checks[0], "labelToken"), TOKEN);
    assert.ok(!s.checks[0].includes('name="labelImage"'), "a label read before the pills is not sent again");
    await page.getByRole("button", {name: "Check more pills from this bottle"}).click();
    await page.getByText("Put the pills you already checked back in the bottle first.").waitFor();
    await page.getByText("Photo 2 of pills").waitFor();
    await shot(page, `more-pills-${width}`);
    await s.choose("Upload a photo", "test-images/real/bottle/pills.jpg");
    await page.getByRole("button", {name: "Check my pills", exact: true}).last().click();
    await page.locator("#bottle-combined").waitFor();
    assert.equal(field(s.checks[1], "morePillsOf"), A); assert.equal(field(s.checks[1], "continuationToken"), TOKEN);
    assert.match(await page.locator("#bottle-combined").innerText(), /^Photo 2: Pill 5 doesn.t match your label\.$/);
    assert.equal(await page.getByRole("tab").count(), 2);
    assert.equal(await page.getByRole("tab", {selected: true}).innerText().then(t => t.startsWith("Photo 2")), true);
    assert.equal(await page.getByRole("button", {name: "Check more pills from this bottle"}).count(), 0, "no more pills once one doesn't match");
    await shot(page, `two-photos-red-${width}`);
    await page.getByRole("tab", {name: /Photo 1/}).click();
    await page.getByText(`All ${green.pills.length} pills we found match your label.`).waitFor();
    await shot(page, `two-photos-tab1-${width}`);
    console.log("ok", width, "2 label photos + 2 pill photos → red", `checks=${s.checks.length}`);
    await page.close();

    // 2. Two label photos that disagree on the strength: Next waits until the person picks.
    const c = await open(width, [
      {labelId: A, labelToken: TOKEN, photos: 1, label: whole, conflicts: [], missing: []},
      {labelId: A, photos: 2, label: {...whole, strength: undefined}, conflicts: [{field: "strength", options: [{value: "1,000 mg", photos: [0]}, {value: "500 mg", photos: [1]}]}], missing: []},
    ]);
    await c.page.route("**/api/check-bottle", async route => { c.checks.push(route.request().postDataBuffer().toString("latin1")); return route.fulfill(ndjson({type: "result", result: green, shareId: A, continuationToken: TOKEN})); });
    await c.choose("Upload a photo", "test-images/real/bottle/label.jpg");
    await c.page.getByText("We read: Metformin HCl 1,000 mg · NDC 70010-065").waitFor();
    await c.choose("Upload another", "test-images/real/bottle/label.jpg");
    await c.page.getByText("Your photos disagree on the strength. Which one is on your label?").waitFor();
    assert.equal(await c.page.getByRole("button", {name: "Next: photo of the pills"}).isDisabled(), true, "never guessed");
    await shot(c.page, `label-conflict-${width}`);
    await c.page.getByRole("button", {name: "500 mg · photo 2"}).click();
    await c.page.getByText("We read: Metformin HCl 500 mg · NDC 70010-065").waitFor();
    await c.page.getByRole("button", {name: "Next: photo of the pills", exact: true}).click();
    await c.choose("Upload a photo", "test-images/real/bottle/pills.jpg");
    await c.page.getByRole("button", {name: "Check my pills", exact: true}).last().click();
    await c.page.locator("#bottle-verdict").waitFor();
    assert.equal(field(c.checks[0], "labelChoices"), '{"strength":1}');
    console.log("ok", width, "label conflict picked → check sends the pick");
    await c.page.close();

    // 3. The label can't be read before the pills (our side): the old one-photo path still works.
    const f = await open(width, ["abort"]);
    await f.page.route("**/api/check-bottle", async route => { f.checks.push(route.request().postDataBuffer().toString("latin1")); return route.fulfill(ndjson({type: "result", result: green, shareId: A, continuationToken: TOKEN})); });
    await f.choose("Upload a photo", "test-images/real/bottle/label.jpg");
    await f.page.getByText("We'll read your label together with the pills.").waitFor();
    await f.page.getByRole("button", {name: "Next: photo of the pills", exact: true}).click();
    await f.choose("Upload a photo", "test-images/real/bottle/pills.jpg");
    await f.page.getByRole("button", {name: "Check my pills", exact: true}).last().click();
    await f.page.locator("#bottle-verdict").waitFor();
    assert.ok(f.checks[0].includes('name="labelImage"') && !f.checks[0].includes('name="labelId"'), "falls back to sending the label photo");
    console.log("ok", width, "label read failed → old path");
    await f.page.close();
  }
} finally { await browser.close(); }

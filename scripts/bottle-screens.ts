// Screenshots of the whole-bottle result states, with no paid calls.
// Real photos: results saved by `npm run smoke:bottle` (cached live readings). Drawn scenes: real segmentation and the
// real engine, with pill readings recorded live from Vedhanth's photos (src/lib/bottle/__fixtures__/real-readings.json),
// picked by each drawn pill's color. FDA lookups are live (free). The /check UI is real; only its API answer is replayed.
// Usage: node --import tsx scripts/bottle-screens.ts [base url]   (dev server must be running)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { chromium, type Page } from "playwright-core";
import type { ImageInput } from "@/lib/ai/client";
import { runBottleCheck, runBottleFollowUp } from "@/lib/bottle/check-bottle";
import recorded from "@/lib/bottle/__fixtures__/real-readings.json";
import { layout, type ScenePill } from "@/lib/bottle/test-scenes";
import type { BottleResult } from "@/lib/bottle/types";
import type { PillReading } from "@/lib/verdict-engine";

const base = process.argv[2] || "http://localhost:3000";
const out = "docs/screenshots/phase-10", work = "test-images/bottle/generated/screens";
const LABEL = { ndc: "70010-065", drugName: "Metformin HCl", strength: "1,000 mg", form: "tablet" };
const WHITE = "#f2f0ea", FACE_DOWN = "#eeeeee", AMOXICILLIN = "#efe2b8";
const readings: Record<string, PillReading> = {
  [WHITE]: recorded.g12 as PillReading,
  [FACE_DOWN]: { ...(recorded.g12 as PillReading), imprintSides: [], imprintConfidence: 0 },
  [AMOXICILLIN]: recorded.amoxicillin2263LowConfidence as PillReading,
};
async function readPill(image: ImageInput): Promise<PillReading> {
  const crop = sharp(Buffer.from(image.base64, "base64")), { width = 0, height = 0 } = await crop.metadata();
  const { data } = await crop.extract({ left: Math.floor(width / 2), top: Math.floor(height / 2), width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
  const hex = `#${[...data.subarray(0, 3)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  if (!readings[hex]) throw new Error(`No recorded reading for drawn color ${hex}`);
  return structuredClone(readings[hex]);
}
const deps = { label: LABEL, readPill };
const spot = (i: number) => ({ cx: 160 + (i % 5) * 220, cy: 300 + Math.floor(i / 5) * 360 });
const spread = (change: Record<number, Partial<ScenePill>> = {}, move: (p: ScenePill) => ScenePill = (p) => p) =>
  layout(Array.from({ length: 10 }, (_, i) => move({ ...spot(i), rx: 60, ry: 33, color: WHITE, ...change[i + 1] })), { gradient: true });
const check = async (photo: Buffer) => { const r = await runBottleCheck({ mediaType: "image/jpeg", base64: "" }, photo, async () => {}, () => {}, deps); if (!r) throw new Error("No result"); return r; };

type Shot = { name: string; label: string; photo: string; result: BottleResult; again?: { photo: string; result: BottleResult } };

async function drawnShots(): Promise<Shot[]> {
  await mkdir(work, { recursive: true });
  const save = async (name: string, bytes: Buffer) => { const file = path.join(work, `${name}.jpg`); await writeFile(file, bytes); return file; };
  const shots: Shot[] = [];
  const green = await spread();
  shots.push({ name: "green-drawn", label: "test-images/real/bottle/label.jpg", photo: await save("green", green), result: await check(green) });
  const faceDown = await spread({ 4: { color: FACE_DOWN } });
  const faceDownResult = await check(faceDown);
  shots.push({ name: "face-down-drawn", label: "test-images/real/bottle/label.jpg", photo: await save("face-down", faceDown), result: faceDownResult });
  const flipped = await spread({}, (p) => ({ ...p, cx: p.cx * 1.04 + 25, cy: p.cy * 1.04 - 30 }));
  const followUp = await runBottleFollowUp(faceDownResult, flipped, async () => {}, () => {}, deps);
  if (!followUp) throw new Error("No follow-up result");
  shots.push({ name: "after-flip-drawn", label: "test-images/real/bottle/label.jpg", photo: await save("face-down", faceDown), result: faceDownResult, again: { photo: await save("flipped", flipped), result: followUp } });
  const odd = await spread({ 5: { color: AMOXICILLIN, rx: 55, ry: 30 } });
  shots.push({ name: "odd-one-out-drawn", label: "test-images/real/bottle/label.jpg", photo: await save("odd", odd), result: await check(odd) });
  const touching = await layout([...Array.from({ length: 8 }, (_, i) => ({ ...spot(i), rx: 60, ry: 33, color: WHITE })), { cx: 500, cy: 880, rx: 60, ry: 33, color: WHITE }, { cx: 590, cy: 880, rx: 60, ry: 33, color: WHITE }], { gradient: true });
  shots.push({ name: "touching-drawn", label: "test-images/real/bottle/label.jpg", photo: await save("touching", touching), result: await check(touching) });
  return shots;
}
async function realShots(): Promise<Shot[]> {
  const saved = async (id: string) => JSON.parse(await readFile(`test-images/bottle/generated/${id}-result.json`, "utf8")) as BottleResult;
  return [
    { name: "real-bottle", label: "test-images/real/bottle/label.jpg", photo: "test-images/real/bottle/pills.jpg", result: await saved("real-bottle") },
    { name: "red-real-three-pills", label: "test-images/real/match/label.jpg", photo: "test-images/real/extra/three-pills-close.jpg", result: await saved("real-three-pills") },
  ];
}

async function answerWith(page: Page, result: BottleResult) {
  await page.unroute("**/api/check-bottle");
  await page.route("**/api/check-bottle", (route) => route.fulfill({ status: 200, contentType: "application/x-ndjson", body: JSON.stringify({ type: "result", result, shareId: "00000000-0000-4000-8000-000000000000" }) + "\n" }));
}
async function upload(page: Page, file: string) {
  await page.locator('input[type=file]:not([capture])').setInputFiles(file);
  await page.locator("img[alt^='Your']").first().waitFor();
}

async function main() {
  const shots = [...await realShots(), ...await drawnShots()];
  for (const s of shots) console.log(s.name, s.result.decision.verdict, "-", s.result.decision.title, s.again ? `→ ${s.again.result.decision.verdict} - ${s.again.result.decision.title}` : "");
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  try {
    for (const width of [375, 1440]) for (const s of shots) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      await page.goto(base + "/check", { waitUntil: "networkidle" });
      await answerWith(page, s.result);
      await upload(page, s.label);
      await page.getByRole("button", { name: "Next: photo of the pills" }).click();
      await upload(page, s.photo);
      await page.getByRole("button", { name: "Check my pills", exact: true }).last().click();
      await page.locator("#bottle-verdict").waitFor();
      if (s.again) {
        await answerWith(page, s.again.result);
        await page.locator("#bottle-verdict").locator("..").getByRole("button").first().click();
        await upload(page, s.again.photo);
        await page.getByRole("button", { name: "Check again" }).click();
        await page.getByText(s.again.result.followUp!.note).waitFor();
      }
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(out, `bottle-${s.name}-${width}.png`), fullPage: true });
      await page.close();
    }
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });

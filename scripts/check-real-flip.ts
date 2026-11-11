// Paid, manual: the mismatch flip with Vedhanth's real photos. "93" side first, then the "2263" side.
// Take the PAID-API LOCK first (see ~/Hackathons/_coord/BOARD.md). Prints readings, verdicts and token totals.
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { setAiUsageObserver, type ImageInput } from "@/lib/ai/client";
import { finishPhotoCheck, runPhotoCheck } from "@/lib/photo-check";

import { phase10bReaders } from './lib/phase10b-readers';

const prepare = async (file: string): Promise<ImageInput> => ({ mediaType: "image/jpeg", base64: (await sharp(await readFile(file)).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()).toString("base64") });
async function main() {
  const budget = process.env.PHASE10B_MODE === '1' ? phase10bReaders() : undefined;
  const usage = { calls: 0, input: 0, output: 0 };
  setAiUsageObserver((_m, input, output) => { usage.calls++; usage.input += input; usage.output += output; });
  const dir = "test-images/real/mismatch/";
  const first = await runPhotoCheck(await prepare(dir + "label.jpg"), await prepare(dir + "pill.jpg"), () => {}, true, budget);
  const before = "flip" in first && first.flip ? first.flip : first.ok ? first.result : null;
  if (!before) throw new Error(`Stopped early: ${JSON.stringify("exit" in first ? first.exit : first)}`);
  console.log(`side 1: label ${before.label.drugName} NDC ${before.label.ndc} · pill "${before.pill.imprintSides.join(" / ")}" → ${before.verdict}${"reason" in first ? ` · flip asked: ${first.reason}` : " · no flip asked"}`);
  console.log(`  reasons: ${before.reasons.join(" | ")}`);
  const after = await finishPhotoCheck(before, await prepare(dir + "pill-back.jpg"), () => {}, budget);
  console.log(`after flip: pill "${after.result.pill.imprintSides.join(" / ")}" → ${after.result.verdict} · identified: ${after.result.identifiedAs?.title ?? "none"} (${after.result.identifiedAs?.labeler ?? ""})`);
  console.log(`  reasons: ${after.result.reasons.join(" | ")}`);
  budget?.report();
  console.log(`AI calls ${usage.calls} · ${usage.input} input + ${usage.output} output tokens · at most $${((usage.input * 2 + usage.output * 10) / 1e6).toFixed(3)} (Sonnet rate upper bound)`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });

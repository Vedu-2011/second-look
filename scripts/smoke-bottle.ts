import type Anthropic from "@anthropic-ai/sdk";
import { mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_VISION_MODEL, getAnthropic, type ImageInput, type ReadOptions } from "@/lib/ai/client";
import { readLabel, readPill } from "@/lib/ai/readers";
import { readPillPrompt, readPillTool } from "@/lib/ai/prompts/read-pill";
import { readLabelPrompt, readLabelTool } from "@/lib/ai/prompts/read-label";
import { runBottleCheck } from "@/lib/bottle/check-bottle";
import type { BottleEvent } from "@/lib/bottle/types";
import type { LabelReading, PillReading } from "@/lib/verdict-engine";
import { BOTTLE_OUTPUT, buildBottleComposites, type CompositeScenario } from "./build-bottle-composites";
import { SmokeLedger, smokeBound, smokeKey } from "./lib/bottle-smoke-cache";

const root = fileURLToPath(new URL("../", import.meta.url));
async function main() {
  const live = process.argv.includes("--live");
  let manifest: { scenarios: CompositeScenario[] };
  try { manifest = JSON.parse(await readFile(path.join(root, BOTTLE_OUTPUT, "manifest.json"), "utf8")); }
  catch { manifest = await buildBottleComposites(); }
  const dir = path.join(root, BOTTLE_OUTPUT);
  await mkdir(dir, { recursive: true });
  let lock;
  try { lock = await open(path.join(dir, "smoke.lock"), "wx"); await lock.writeFile(String(process.pid)); }
  catch { throw new Error("Another smoke owns the usage ledger (or a previous run stopped). Inspect smoke.lock before retrying. No AI calls made."); }
  try {
    const ledger = new SmokeLedger(path.join(dir, "usage-ledger.json"), Number(process.env.BOTTLE_SMOKE_BUDGET_USD || 1));
    const cleaningVersion = await Promise.all(["src/lib/ai/clean-pill.ts", "src/lib/ai/schemas.ts"].map((p) => readFile(path.join(root, p), "utf8")));
    const pending = new Map<string, Promise<PillReading | LabelReading>>();
    let cacheHits = 0;
    async function cachedRead(image: ImageInput, kind: "pill" | "label", options: ReadOptions = {}) {
      const prompt = kind === "pill" ? readPillPrompt : readLabelPrompt;
      const tool = kind === "pill" ? readPillTool : readLabelTool;
      const key = smokeKey(Buffer.from(image.base64, "base64"), DEFAULT_VISION_MODEL, JSON.stringify({ prompt, tool, cleaningVersion, maxTokens: 1200, mediaType: image.mediaType }));
      const inFlight = pending.get(key);
      if (inFlight) { cacheHits++; return inFlight; }
      const cached = ledger.cached(key);
      if (cached) { cacheHits++; return cached; }
      const task = (async () => {
        if (!live) throw new Error(`No cached ${kind} reading for ${key.slice(0, 12)}. Re-run with --live to authorize this script's budgeted calls. No paid call was made.`);
        if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
        const counted = await getAnthropic(0).messages.countTokens({
          model: DEFAULT_VISION_MODEL, system: prompt, tools: [tool as unknown as Anthropic.Tool], tool_choice: { type: "auto" },
          messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } }, { type: "text", text: "Use the tool and return only the structured reading." }] }],
        });
        ledger.reserve(key, smokeBound(counted.input_tokens));
        let attempts = 0, halted = false;
        try {
          const reading = await (kind === "pill" ? readPill : readLabel)(image, {
            model: DEFAULT_VISION_MODEL, maxRetries: 0,
            beforeAttempt: async () => { if (halted || ++attempts > 2) throw new Error("Smoke request attempt limit"); },
            onUsage: (model, input, output) => {
              try { ledger.usage(key, model, input, output); options.onUsage?.(model, input, output); }
              catch (e) { halted = true; throw e; }
            },
          });
          ledger.finish(key, reading); return reading;
        } catch (e) { ledger.fail(key); throw e; }
      })();
      pending.set(key, task);
      return task;
    }
    const outputs: unknown[] = [];
    const mockLabelImage: ImageInput = { base64: "", mediaType: "image/jpeg" }; // Declared development labels, never passed to AI.
    async function checkScenario(id: string, bytes: Buffer, label: LabelReading, expectedCount?: number) {
      const events: BottleEvent[] = [], before = ledger.spent(), started = performance.now();
      let readerFailure: unknown;
      const result = await runBottleCheck(mockLabelImage, bytes, async () => {}, (e) => events.push(e), {
        label,
        readPill: async (image, options) => {
          try { return await cachedRead(image, "pill", options) as PillReading; }
          catch (e) { readerFailure = e; throw e; }
        },
      });
      // Production abstains on a failed crop; smoke must explicitly fail rather than call it a success.
      if (readerFailure) throw readerFailure;
      if (!result) throw new Error(`${id}: ${JSON.stringify(events.find((e) => e.type === "retake"))}`);
      if (expectedCount && result.pills.length !== expectedCount) throw new Error(`${id}: found ${result.pills.length}, expected ${expectedCount}; no accuracy claim permitted.`);
      const output = { scenario: id, scope: "Functional demo, not benchmark evidence", perPill: result.pills.map((p) => ({ number: p.number, verdict: p.result.verdict, imprint: p.result.pill.imprintSides, imprintConfidence: p.result.pill.imprintConfidence, colors: p.result.pill.colors, shape: p.result.pill.shape, identifiedAs: p.result.identifiedAs?.title ?? null, appearanceWarning: p.appearanceWarning ?? null, odd: p.odd ?? null, faceDown: p.faceDown ?? false })), clumps: result.clumps ?? [], bottle: result.decision, elapsedMs: Math.round(performance.now() - started), newSpendUsd: ledger.spent() - before, totalUsage: ledger.summary(), cacheHits };
      outputs.push(output);
      await writeFile(path.join(dir, `${id}-result.json`), JSON.stringify(result, null, 2) + "\n");
      console.log(JSON.stringify(output, null, 2));
    }
    console.log(`Mode: ${live ? "LIVE, budget reserved before every unique reading" : "CACHE ONLY, no paid calls"}. Model ${DEFAULT_VISION_MODEL}; standard $2 input / $10 output per million. Ledger ${path.join(BOTTLE_OUTPUT, "usage-ledger.json")}`);
    for (const scenario of manifest.scenarios) await checkScenario(scenario.id, await readFile(path.join(root, scenario.image)), scenario.label, scenario.expectedCount);
    const realDir = path.join(root, "test-images/real/bottle");
    const realLabel = await readFile(path.join(realDir, "label.jpg")).catch(() => null);
    const realPills = await readFile(path.join(realDir, "pills.jpg")).catch(() => null);
    if (realLabel && realPills) {
      const label = await cachedRead({ mediaType: "image/jpeg", base64: realLabel.toString("base64") }, "label") as LabelReading;
      await checkScenario("real-bottle", realPills, label, 10);
    } else console.log("Real bottle pair absent: skipped. Composites are not real-bottle validation.");
    // Three loose pills (metformin G 12, amoxicillin 93, Tylenol) with the metformin label TYPED, not read from a photo.
    const threePills = await readFile(path.join(root, "test-images/real/extra/three-pills-close.jpg")).catch(() => null);
    if (threePills) await checkScenario("real-three-pills", threePills, { ndc: "70010-065", drugName: "Metformin", strength: "1,000 mg", form: "tablet" }, 3);
    await writeFile(path.join(dir, "smoke-output.json"), JSON.stringify({ outputs, usage: ledger.summary() }, null, 2) + "\n");
    console.log(JSON.stringify({ final: ledger.summary(), cacheHits }));
  } finally { await lock.close(); await unlink(path.join(dir, "smoke.lock")); }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : "Bottle smoke failed"); process.exitCode = 1; });

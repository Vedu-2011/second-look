import { readFile } from "node:fs/promises";
import { getAnthropic, textModel, visionModel } from "@/lib/ai/client";
import { explain } from "@/lib/ai/explain";
import { readLabel, readPill } from "@/lib/ai/readers";
import { runCheck } from "@/lib/check-service";

const root = new URL("../", import.meta.url);
const image = async (path: string, mediaType: "image/png" | "image/jpeg") => ({ mediaType, base64: (await readFile(new URL(path, root))).toString("base64") });

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("SKIPPED: ANTHROPIC_API_KEY is not set; live reader smoke was not run.");
    return;
  }
  const client = getAnthropic();
  const models = await client.models.list();
  const ids = new Set(models.data.map((model) => model.id));
  console.log(`Models: vision=${visionModel()} ${ids.has(visionModel()) ? "available" : "NOT LISTED"}; text=${textModel()} ${ids.has(textModel()) ? "available" : "NOT LISTED"}`);
  const started = performance.now();
  const label = await readLabel(await image("test-images/labels/rendered/match.png", "image/png"));
  const pill = await readPill(await image("test-images/pills/strattera-10mg-1.jpg", "image/jpeg"));
  const result = await runCheck(label, pill);
  const explanation = await explain(result);
  console.log(JSON.stringify({ label, pill, verdict: result.verdict, explanation, elapsedMs: Math.round(performance.now() - started) }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

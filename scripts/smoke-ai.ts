import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { getAnthropic, setAiUsageObserver, textModel, visionModel } from "@/lib/ai/client";
import { explain } from "@/lib/ai/explain";
import { readLabel, readPill } from "@/lib/ai/readers";
import { runCheck } from "@/lib/check-service";

const root = new URL("../", import.meta.url);
const image = async (path: string, mediaType: "image/png" | "image/jpeg") => ({ mediaType, base64: (await readFile(new URL(path, root))).toString("base64") });
const price = (model: string) => model.startsWith("claude-sonnet-5-5") ? [2, 10] : model.startsWith("claude-haiku-5-5") ? [0.1, 0.5] : null;

async function apiSmoke(labelImage: Awaited<ReturnType<typeof image>>, pillImage: Awaited<ReturnType<typeof image>>) {
  const port = 3211;
  const base = `http://127.0.0.1:${port}`;
  const server = spawn("npm", ["run", "start", "--", "-p", String(port)], { cwd: new URL("../", import.meta.url), env: process.env, stdio: "ignore" });
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (server.exitCode !== null) throw new Error("The production server stopped before the smoke check.");
      try { if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; } } catch { /* still starting */ }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error("The production server did not start; run npm run build first.");
    const started = performance.now();
    const response = await fetch(`${base}/api/check`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        labelImage: { dataUrl: `data:${labelImage.mediaType};base64,${labelImage.base64}` },
        pillImage: { dataUrl: `data:${pillImage.mediaType};base64,${pillImage.base64}` },
      }),
    });
    if (!response.ok) throw new Error(`/api/check returned ${response.status}: ${await response.text()}`);
    const events = (await response.text()).trim().split("\n").map((line) => JSON.parse(line) as { type: string; [key: string]: unknown });
    const terminal = events.findLast((event) => ["result", "error", "early_exit"].includes(event.type));
    if (!terminal || terminal.type === "error") throw new Error(`/api/check did not return a result: ${JSON.stringify(terminal)}`);
    const result = terminal.result as { verdict?: string; shareId?: string } | undefined;
    let shareStatus: number | null = null;
    if (result?.shareId) shareStatus = (await fetch(`${base}/result/${result.shareId}`)).status;
    return { eventOrder: events.map((event) => event.type === "step" ? `step:${event.step}:${event.state}` : event.type), terminalType: terminal.type, verdict: result?.verdict ?? null, timings: terminal.timings ?? null, shareStatus, elapsedMs: Math.round(performance.now() - started) };
  } finally { server.kill("SIGTERM"); }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("SKIPPED: ANTHROPIC_API_KEY is not set; live reader smoke was not run.");
    return;
  }
  const models = await getAnthropic().models.list();
  const ids = new Set(models.data.map((model) => model.id));
  if (!ids.has(visionModel()) || !ids.has(textModel())) throw new Error("The configured vision or text model was not listed by Anthropic.");
  console.log(`Models: vision=${visionModel()} available; text=${textModel()} available`);
  const usage: { model: string; inputTokens: number; outputTokens: number; estimatedUsd: number | null }[] = [];
  setAiUsageObserver((model, inputTokens, outputTokens) => {
    const rates = price(model);
    usage.push({ model, inputTokens, outputTokens, estimatedUsd: rates ? Number(((inputTokens * rates[0] + outputTokens * rates[1]) / 1_000_000).toFixed(6)) : null });
  });
  const labelImage = await image("test-images/labels/rendered/match.png", "image/png");
  const pillImage = await image("test-images/pills/strattera-10mg-1.jpg", "image/jpeg");
  const started = performance.now();
  const [label, pill] = await Promise.all([readLabel(labelImage), readPill(pillImage)]);
  const result = await runCheck(label, pill);
  const explanation = await explain(result);
  console.log(JSON.stringify({ directReaders: { label, pill, verdict: result.verdict, explanation, elapsedMs: Math.round(performance.now() - started), usage, estimatedUsd: Number(usage.reduce((sum, item) => sum + (item.estimatedUsd ?? 0), 0).toFixed(6)) } }, null, 2));
  setAiUsageObserver();
  console.log(JSON.stringify({ fullApiCheck: await apiSmoke(labelImage, pillImage) }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

import { DEFAULT_VISION_MODEL, type ImageInput, type ReadOptions } from "@/lib/ai/client";
import { readLabel, readPill } from "@/lib/ai/readers";
import { earlyExit } from "@/lib/check-input";
import { resolveLabelData, runResolvedCheck } from "@/lib/check-service";
import type { LabelReading, PillReading } from "@/lib/verdict-engine";
import { appearanceWarning, decideBottle } from "./decide-bottle";
import { segmentBottle, SegmentationError, type SegmentedBottle } from "./segment";
import type { BottleEvent, BottlePill, BottleResult } from "./types";

export class BottleQuotaError extends Error {}
export const unreadablePill = (): PillReading => ({ imprintSides: [], imprintConfidence: 0, colors: [], colorConfidence: 0, shape: "unknown", shapeConfidence: 0, pillVisible: false });

/** At most five in-flight Sonnet readers. Each request has its own accounting callback. */
export async function mapFive<T, R>(items: readonly T[], work: (item: T, index: number) => Promise<R>): Promise<R[]> {
  let cursor = 0;
  const out: R[] = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(5, items.length) }, async () => {
    while (cursor < items.length) { const i = cursor++; out[i] = await work(items[i], i); }
  }));
  return out;
}

type Send = (event: BottleEvent) => void;
export type BottleDependencies = {
  readPill?: (image: ImageInput, options: ReadOptions) => Promise<PillReading>;
  /** For the development-only smoke with a declared label, never a browser request. */
  label?: LabelReading;
  onUsage?: ReadOptions["onUsage"];
};
export async function runBottleCheck(
  labelImage: ImageInput,
  bottleImage: Buffer,
  reserveRemaining: (pillCount: number) => Promise<void>,
  send: Send = () => {},
  dependencies: BottleDependencies = {},
): Promise<BottleResult | null> {
  const started = performance.now();
  const usage: BottleResult["usage"] = [];
  const onUsage: ReadOptions["onUsage"] = (model, inputTokens, outputTokens) => {
    usage.push({ model, inputTokens, outputTokens, estimatedUsd: model === DEFAULT_VISION_MODEL ? (inputTokens * 2 + outputTokens * 10) / 1e6 : null });
    dependencies.onUsage?.(model, inputTokens, outputTokens);
  };
  send({ type: "step", step: 0, state: "working" });
  const label = dependencies.label ?? await readLabel(labelImage, { model: DEFAULT_VISION_MODEL, onUsage });
  const exit = earlyExit(label, { ...unreadablePill(), pillVisible: true });
  if (exit?.kind === "label") {
    send({ type: "step", step: 0, state: "failed" });
    send({ type: "retake", message: exit.message, code: exit.code });
    return null;
  }
  send({ type: "step", step: 0, state: "done" });
  // Segment BEFORE any pill AI; a rejected photo never reads a crop.
  send({ type: "step", step: 1, state: "working" });
  let segmented: SegmentedBottle;
  try { segmented = await segmentBottle(bottleImage); } catch (error) {
    if (!(error instanceof SegmentationError)) throw error;
    send({ type: "step", step: 1, state: "failed" });
    send({ type: "retake", code: error.code, message: error.message });
    return null;
  }
  send({ type: "step", step: 1, state: "done" });
  send({ type: "segmented", boxes: segmented.boxes, image: segmented.image });
  // Initial quota was reserved by the API. Reserve all remaining units before ANY crop reads.
  await reserveRemaining(segmented.crops.length);
  // Fetch expected records ONCE, and deduplicate simultaneous mismatch leads/DailyMed requests.
  const resolved = await resolveLabelData(label);
  send({ type: "step", step: 2, state: "working" });
  let completed = 0;
  const readings = await mapFive(segmented.crops, async (crop) => {
    let reading: PillReading;
    try { reading = await (dependencies.readPill ?? readPill)({ mediaType: "image/png", base64: crop.toString("base64") }, { model: DEFAULT_VISION_MODEL, onUsage }); }
    catch { reading = unreadablePill(); } // A failed reader abstains; never turns a partial bottle green.
    send({ type: "progress", completed: ++completed, total: segmented.crops.length });
    return reading;
  });
  send({ type: "step", step: 2, state: "done" });
  send({ type: "step", step: 3, state: "working" });
  const pills = await mapFive(readings, async (reading, i): Promise<BottlePill> => {
    const pill: BottlePill = { number: i + 1, box: segmented.boxes[i], result: await runResolvedCheck(label, reading, resolved) };
    pill.appearanceWarning = appearanceWarning(pill);
    return pill;
  });
  send({ type: "step", step: 3, state: "done" });
  return { kind: "bottle", label, pills, decision: decideBottle(pills), image: segmented.image, checkedAt: new Date().toISOString(), elapsedMs: Math.round(performance.now() - started), usage };
}

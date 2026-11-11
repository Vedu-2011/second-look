import { mergePillViews } from "@/lib/pill-views";
import { DEFAULT_VISION_MODEL, type ImageInput, type ReadOptions } from "@/lib/ai/client";
import { readLabel, readPill } from "@/lib/ai/readers";
import { earlyExit } from "@/lib/check-input";
import { resolveLabelData, runResolvedCheck, type ResolvedLabelData } from "@/lib/check-service";
import type { LabelReading, PillReading } from "@/lib/verdict-engine";
import { annotatePills, appearanceWarning, decideBottle } from "./decide-bottle";
import { planFollowUp } from "./match-positions";
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
  const pills = await readAndCheck(label, segmented, segmented.crops.map((_, i) => i), new Map(), resolved, send, dependencies, onUsage);
  return { kind: "bottle", label, pills, clumps: segmented.clumps, decision: decideBottle(pills, segmented.clumps), image: segmented.image, checkedAt: new Date().toISOString(), elapsedMs: Math.round(performance.now() - started), usage };
}

/** Reads only the crops in `read`; every other pill keeps the reading it had in the first photo. */
async function readAndCheck(label: LabelReading, segmented: SegmentedBottle, read: number[], reused: Map<number, BottlePill>, resolved: ResolvedLabelData, send: Send, dependencies: BottleDependencies, onUsage: ReadOptions["onUsage"], followUp = false, prior = new Map<number, BottlePill>()) {
  send({ type: "step", step: 2, state: "working" });
  let completed = 0;
  send({ type: "progress", completed, total: read.length });
  const readings = new Map<number, PillReading>(await mapFive(read, async (i): Promise<[number, PillReading]> => {
    let reading: PillReading;
    try { reading = await (dependencies.readPill ?? readPill)({ mediaType: "image/png", base64: segmented.crops[i].toString("base64") }, { model: DEFAULT_VISION_MODEL, onUsage }); }
    catch { reading = unreadablePill(); } // A failed reader abstains; never turns a partial bottle green.
    send({ type: "progress", completed: ++completed, total: read.length });
    return [i, reading];
  }));
  send({ type: "step", step: 2, state: "done" });
  send({ type: "step", step: 3, state: "working" });
  const pills = await mapFive(segmented.boxes, async (box, i): Promise<BottlePill> => {
    const kept = reused.get(i), reading = readings.get(i), before = prior.get(i);
    const combined = reading && before && followUp ? mergePillViews([before.result.pill, reading]) : reading;
    let result = kept && !reading ? { ...kept.result, verdict: "UNSURE" as const, matchedProduct: null, identifiedAs: null,
      reasons: ["Earlier photo only. Position cannot confirm the pill in this photo; a new green result requires reading it again."] }
      : await runResolvedCheck(label, combined ?? unreadablePill(), resolved);
    // A reverse view cannot erase an already confident mismatch (including an unreadable/conflicting reverse).
    if (before?.result.verdict === "MISMATCH" && result.verdict !== "MISMATCH") result = { ...result, verdict: "MISMATCH", identifiedAs: null, reasons: [...result.reasons, "The first view already showed an imprint that does not match your label. That mismatch still stands."] };
    const pill: BottlePill = { number: i + 1, box, result, features: segmented.features[i], ...(reading && followUp ? { reread: true } : {}), ...(kept && !reading ? { carried: true } : {}) };
    pill.appearanceWarning = appearanceWarning(pill);
    return pill;
  });
  send({ type: "step", step: 3, state: "done" });
  return annotatePills(pills);
}

const listNumbers = (n: readonly number[]) => n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n.at(-1)}` : String(n[0]);
/**
 * "Flip and snap again": the same spread, with the circled pills flipped in place. Re-reads only those pills (and
 * any that were touching and are now apart); every other pill keeps its first reading. The label is the one
 * already read. If the pills can't be matched by position, checks every pill again and says so.
 */
export async function runBottleFollowUp(
  previous: BottleResult,
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
  send({ type: "step", step: 0, state: "done" });
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
  const plan = planFollowUp(previous, segmented);
  const read = plan.mode === "fresh" ? segmented.crops.map((_, i) => i) : plan.reread;
  await reserveRemaining(read.length);
  const resolved = await resolveLabelData(previous.label);
  let pills = await readAndCheck(previous.label, segmented, read, plan.mode === "fresh" ? new Map() : plan.reused, resolved, send, dependencies, onUsage, plan.mode === "reread", plan.mode === "reread" ? plan.prior : new Map());
  const unresolvedRegions = plan.mode === "reread" ? plan.unresolvedRegions : (previous.unresolvedRegions ?? 0) + (previous.clumps?.length ?? 0);
  // Geometry is enough to guide a flip, never to certify a new green bottle. Read all carried pills before green.
  const carriedIndices = pills.flatMap((p, i) => p.carried ? [i] : []);
  if (carriedIndices.length && !unresolvedRegions && !segmented.clumps.length && pills.filter(p => !p.carried).every(p => p.result.verdict === "MATCH" || p.result.verdict === "SAME_MEDICINE_DIFFERENT_MAKER")) {
    await reserveRemaining(segmented.crops.length);
    const kept = new Map(pills.flatMap((p, i) => p.carried ? [] : [[i, p] as [number, BottlePill]]));
    const verified = await readAndCheck(previous.label, segmented, carriedIndices, new Map(), resolved, send, dependencies, onUsage);
    pills = annotatePills(verified.map((p, i) => kept.get(i) ?? { ...p, reread: true }));
    read.push(...carriedIndices);
  }
  const reread = [...new Set(read)].sort((a, b) => a - b).map((i) => i + 1), reused = segmented.boxes.length - reread.length;
  const note = plan.mode === "fresh" ? plan.reason
    : !reread.length ? `No new readings were made. All ${reused} earlier readings remain unconfirmed in this photo.`
    : `We read ${reread.length === 1 ? "pill" : "pills"} ${listNumbers(reread)} again and kept the other ${reused} ${reused === 1 ? "reading" : "readings"} as unconfirmed history from your first photo.`;
  return { kind: "bottle", label: previous.label, pills, clumps: segmented.clumps, decision: unresolvedRegions && decideBottle(pills, segmented.clumps).verdict !== "MISMATCH" ? { ...decideBottle(pills, segmented.clumps), verdict: "UNSURE", title: "A circled region from an earlier photo is still unaccounted for.", instruction: "We cannot finish this bottle check. Put every pill back in view and start a new check.", asks: [], next: undefined } : decideBottle(pills, segmented.clumps), unresolvedRegions, image: segmented.image, checkedAt: new Date().toISOString(), elapsedMs: Math.round(performance.now() - started), usage, followUp: { mode: plan.mode, reread, reused, note } };
}

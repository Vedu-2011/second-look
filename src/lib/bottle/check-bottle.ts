import { captureCoaching } from "./coaching";
import { applyConsensus } from "./consensus";
import { agreeReadings, borderline, expectedFragment, MAX_EXTRA_READS, nearMissSide, secondReadImage, spacedImprint } from "./double-read";
import { mergePillViews } from "@/lib/pill-views";
import { normalizeToken } from "@/lib/match/imprint";
import { DEFAULT_VISION_MODEL, type ImageInput, type ReadOptions } from "@/lib/ai/client";
import { readLabel, readPill, readPillGroup } from "@/lib/ai/readers";
import { earlyExit } from "@/lib/check-input";
import { resolveLabelData, runResolvedCheck, type ResolvedLabelData } from "@/lib/check-service";
import type { LabelReading, PillReading } from "@/lib/verdict-engine";
import { annotatePills, appearanceWarning, decideBottle } from "./decide-bottle";
import { planFollowUp } from "./match-positions";
import { oneRegionsToRead, pileCrop, pilePills, pilesToRead, PILE_READ_UNITS, readingOrder, type PilePill, type PileReader } from "./pile";
import { MAX_BOTTLE_PILLS, segmentBottle, SegmentationError, type SegmentedBottle } from "./segment";
import type { BottleClump, BottleEvent, BottlePill, BottleResult } from "./types";

export class BottleQuotaError extends Error {}
export const unreadablePill = (): PillReading => ({ imprintSides: [], imprintConfidence: 0, colors: [], colorConfidence: 0, shape: "unknown", shapeConfidence: 0, pillVisible: false });

/** At most five in-flight Sonnet readers. Each request has its own accounting callback. */
export async function mapFive<T, R>(items: readonly T[], work: (item: T, index: number) => Promise<R>): Promise<R[]> {
  let cursor = 0;
  const out: R[] = new Array(items.length);
  let failed = false, failure: unknown;
  await Promise.all(Array.from({ length: Math.min(5, items.length) }, async () => {
    while (cursor < items.length && !failed) { const i = cursor++; try { out[i] = await work(items[i], i); } catch (error) { failed = true; failure = error; } }
  }));
  // Drain already-started requests before the API closes its stream; start none after quota failure.
  if (failed) throw failure;
  return out;
}

type Send = (event: BottleEvent) => void;
export type BottleDependencies = {
  readPill?: (image: ImageInput, options: ReadOptions) => Promise<PillReading>;
  /** Pile reader for touching pills (bottle mode only). */
  readPillGroup?: PileReader;
  /** The label reader; the API passes a cached one so a retry of the same photos doesn't pay twice. */
  readLabel?: (image: ImageInput, options: ReadOptions) => Promise<LabelReading>;
  /** For the development-only smoke with a declared label, never a browser request. */
  label?: LabelReading;
  onUsage?: ReadOptions["onUsage"];
  prepared?: SegmentedBottle;
  checkAnyway?: boolean;
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
  // Segment BEFORE any pill AI; a rejected photo never reads a crop.
  send({ type: "step", step: 1, state: "working" });
  let segmented: SegmentedBottle;
  try { segmented = dependencies.prepared ?? await segmentBottle(bottleImage); } catch (error) {
    if (!(error instanceof SegmentationError)) throw error;
    send({ type: "step", step: 1, state: "failed" });
    send({ type: "retake", code: error.code, message: error.message });
    return null;
  }
  send({ type: "step", step: 1, state: "done" });
  send({ type: "segmented", boxes: segmented.boxes, image: segmented.image });
  const tips = captureCoaching(segmented);
  if (tips.length && !dependencies.checkAnyway) { send({ type: "coaching", tips }); return null; }
  send({ type: "step", step: 0, state: "working" });
  const label = dependencies.label ?? await (dependencies.readLabel ?? readLabel)(labelImage, { model: DEFAULT_VISION_MODEL, onUsage });
  const exit = earlyExit(label, { ...unreadablePill(), pillVisible: true });
  if (exit?.kind === "label") {
    send({ type: "step", step: 0, state: "failed" });
    send({ type: "retake", message: exit.message, code: exit.code });
    return null;
  }
  send({ type: "step", step: 0, state: "done" });
  // Initial quota was reserved by the API. Reserve all remaining units before ANY crop reads.
  // Each pile read counts like PILE_READ_UNITS pill reads.
  const planned = segmented.crops.length + oneRegionsToRead(segmented.clumps, segmented.crops.length).length + PILE_READ_UNITS * pilesToRead(segmented.clumps).length;
  await reserveRemaining(planned);
  // Fetch expected records ONCE, and deduplicate simultaneous mismatch leads/DailyMed requests.
  const resolved = await resolveLabelData(label);
  const budget = readingBudget(planned, reserveRemaining);
  const separate = await readAndCheck(label, segmented, segmented.crops.map((_, i) => i), new Map(), resolved, send, dependencies, onUsage, budget);
  const regions = await readOneRegions(label, segmented, separate.length, resolved, dependencies, onUsage, budget);
  const piled = await readPiles(bottleImage, label, regions.segmented, separate.length + regions.pills.length, resolved, dependencies, onUsage, budget);
  const pills = applyConsensus(annotatePills([...separate, ...regions.pills, ...piled.pills]), piled.clumps);
  return { kind: "bottle", label, pills, clumps: piled.clumps, decision: decideBottle(pills, piled.clumps), image: segmented.image, checkedAt: new Date().toISOString(), elapsedMs: Math.round(performance.now() - started), usage };
}

type ReadingBudget = { planned: number; extras: number; reserve: (total: number) => Promise<void> };
function readingBudget(planned: number, reserve: (n: number) => Promise<void>): ReadingBudget {
  let queue = Promise.resolve();
  return { planned, extras: 0, reserve(total) { const next = queue.then(() => reserve(total)); queue = next; return next; } };
}

/** Reads only the crops in `read`; every other pill keeps the reading it had in the first photo. */
async function readAndCheck(label: LabelReading, segmented: SegmentedBottle, read: number[], reused: Map<number, BottlePill>, resolved: ResolvedLabelData, send: Send, dependencies: BottleDependencies, onUsage: ReadOptions["onUsage"], budget: ReadingBudget, followUp = false, prior = new Map<number, BottlePill>()) {
  send({ type: "step", step: 2, state: "working" });
  let completed = 0;
  send({ type: "progress", completed, total: read.length });
  const doubleReads = new Map<number, NonNullable<BottlePill["doubleRead"]>>();
  const readings = new Map<number, PillReading>(await mapFive(read, async (i): Promise<[number, PillReading]> => {
    let reading: PillReading;
    try {
      const reader = dependencies.readPill ?? readPill;
      reading = await reader({ mediaType: "image/png", base64: segmented.crops[i].toString("base64") }, { model: DEFAULT_VISION_MODEL, onUsage });
      const second = await secondRead(reading, segmented.crops[i], reader, budget, resolved, onUsage);
      if (second) { reading = second.reading; doubleReads.set(i, second.evidence); }
    } catch (error) { if (error instanceof BottleQuotaError) throw error; reading = unreadablePill(); } // A failed reader abstains; never turns a partial bottle green.
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
    const pill: BottlePill = { number: i + 1, box, result, features: segmented.features[i], ...(segmented.outlines?.[i] ? { outline: segmented.outlines[i] } : {}), ...(reading && followUp ? { reread: true } : {}), ...(kept && !reading ? { carried: true, previousVerdict: kept.previousVerdict ?? kept.result.verdict } : {}) };
    const checked = withDoubleRead(pill, doubleReads.get(i));
    // A mismatch carried from the first photo stands; only a fresh reading gets the near-miss second opinion.
    return reading && before?.result.verdict !== "MISMATCH" ? confirmNearMiss(checked, async () => segmented.crops[i], dependencies.readPill ?? readPill, budget, onUsage) : checked;
  });
  send({ type: "step", step: 3, state: "done" });
  return annotatePills(pills);
}

type DoubleRead = NonNullable<BottlePill["doubleRead"]>;
/** One independent second reading of a borderline crop (2x upscale), within the per-request extra-read cap. */
async function secondRead(reading: PillReading, crop: Buffer, reader: NonNullable<BottleDependencies["readPill"]>, budget: ReadingBudget, resolved: ResolvedLabelData, onUsage: ReadOptions["onUsage"]): Promise<{ reading: PillReading; evidence: DoubleRead } | null> {
  if (!borderline(reading) || budget.extras >= MAX_EXTRA_READS) return null;
  budget.extras++;
  await budget.reserve(budget.planned + budget.extras);
  let attempt = 0;
  try {
    const transformed = await secondReadImage(crop);
    const second = await reader({ mediaType: "image/png", base64: transformed.toString("base64") }, { model: DEFAULT_VISION_MODEL, onUsage, maxRetries: 0, beforeAttempt: async () => { if (++attempt > 1) throw new Error("One independent second read only"); } });
    const agreed = agreeReadings(reading, second);
    if (agreed.evidence.agreed && expectedFragment(reading, resolved.data?.labelProduct)) { agreed.reading.imprintConfidence = reading.imprintConfidence; agreed.evidence.partial = true; }
    return agreed;
  } catch (error) {
    if (error instanceof BottleQuotaError) throw error;
    // A refused or failed second read never confirms: capped below the engine's bar, and said plainly.
    return { reading: { ...reading, imprintConfidence: Math.min(reading.imprintConfidence, .69) }, evidence: { agreed: false, failed: true, firstConfidence: reading.imprintConfidence, secondConfidence: 0, firstImprint: reading.imprintSides, secondImprint: [] } };
  }
}
function withDoubleRead(pill: BottlePill, doubleRead?: DoubleRead): BottlePill {
  if (doubleRead) {
    pill.doubleRead = doubleRead;
    pill.result = { ...pill.result, reasons: [...pill.result.reasons, doubleRead.failed ? "We tried to read it a second time but couldn't, so this pill isn't confirmed." : doubleRead.partial ? "Read twice, same expected fragment; this is not a complete imprint confirmation." : doubleRead.agreed ? "Read twice, same normalized imprint. The independent readings agreed." : "The independent second reading did not agree clearly enough; the imprint remains uncertain."] };
  }
  pill.appearanceWarning = appearanceWarning(pill);
  return pill;
}

/**
 * Phase 11d: a MISMATCH whose print is one character off the label's own imprint (TB 200 for IB 200) is most likely a
 * misread. It stays red only if an independent second read (2x upscale of the pill's own crop) says the same thing.
 * A second read that says the label imprint, says something else, fails, or can't run (extra-read budget used up)
 * makes it UNSURE: never MATCH from this path. Prints clearly different from the label (93, TYLENOL 500) are untouched.
 * A near-miss print that is already UNSURE (low or borderline confidence) gets the same "might say" line, no extra read.
 */
async function confirmNearMiss(pill: BottlePill, crop: () => Promise<Buffer>, reader: NonNullable<BottleDependencies["readPill"]>, budget: ReadingBudget, onUsage: ReadOptions["onUsage"]): Promise<BottlePill> {
  const { result } = pill, expectedRaw = result.expected?.imprintRaw;
  const side = nearMissSide(result.pill, expectedRaw);
  // A red pill whose borderline reread already agreed has had its second opinion.
  if (!side || !expectedRaw || !["MISMATCH", "UNSURE"].includes(result.verdict) || (result.verdict === "MISMATCH" && pill.doubleRead?.agreed)) return pill;
  const might = `This might say ${spacedImprint(expectedRaw)}, but we couldn't read it clearly. Check it with your pharmacist.`;
  // Already unsure (e.g. a borderline read whose reread disagreed or failed): just say what it might be. No extra read.
  if (result.verdict === "UNSURE") return { ...pill, result: { ...result, reasons: [might, ...result.reasons] } };
  const first = { firstConfidence: result.pill.imprintConfidence, firstImprint: result.pill.imprintSides };
  const unsure = (why: string, doubleRead?: DoubleRead): BottlePill => ({ ...pill, ...(doubleRead ? { doubleRead } : {}),
    result: { ...result, verdict: "UNSURE", identifiedAs: null, matchedProduct: null, reasons: [might, ...result.reasons, why] } });
  if (budget.extras >= MAX_EXTRA_READS) return unsure("We couldn't double-check this print, so it isn't marked as wrong.");
  budget.extras++;
  await budget.reserve(budget.planned + budget.extras);
  let second: PillReading, attempt = 0;
  try {
    const transformed = await secondReadImage(await crop());
    second = await reader({ mediaType: "image/png", base64: transformed.toString("base64") }, { model: DEFAULT_VISION_MODEL, onUsage, maxRetries: 0, beforeAttempt: async () => { if (++attempt > 1) throw new Error("One independent second read only"); } });
  } catch (error) {
    if (error instanceof BottleQuotaError) throw error;
    return unsure("We tried to read it a second time but couldn't, so it isn't marked as wrong.", { agreed: false, failed: true, ...first, secondConfidence: 0, secondImprint: [] });
  }
  const evidence = { ...first, secondConfidence: second.imprintConfidence, secondImprint: second.imprintSides };
  if (second.imprintConfidence >= .5 && second.imprintSides.some((s) => normalizeToken(s) === normalizeToken(side)))
    return { ...pill, doubleRead: { agreed: true, ...evidence }, result: { ...result, reasons: [...result.reasons, `Read twice: both reads say ${side}.`] } };
  return unsure(`A second read said ${second.imprintSides.join(" / ") || "nothing clear"}.`, { agreed: false, ...evidence });
}

/**
 * A "touching" region about one pill in size (0.5–1.3 typical pills) is read with the single-pill reader,
 * 1 unit, like any separate pill (borderline double-read and the near-miss rule included). If the reader says it sees
 * several pills or no pill, or the read fails, the region stays "Not read". Returns the photo with those regions
 * marked as read and their boxes taken, so the pile reader skips them.
 */
async function readOneRegions(label: LabelReading, segmented: SegmentedBottle, firstNumber: number, resolved: ResolvedLabelData, dependencies: BottleDependencies, onUsage: ReadOptions["onUsage"], budget: ReadingBudget): Promise<{ pills: BottlePill[]; segmented: SegmentedBottle }> {
  const clumps = segmented.clumps.map((c) => ({ ...c })), reader = dependencies.readPill ?? readPill;
  const read = await mapFive(oneRegionsToRead(clumps, firstNumber), async (i) => {
    const crop = segmented.clumpCrops?.[i];
    if (!crop) return null;
    try {
      let reading = await reader({ mediaType: "image/png", base64: crop.toString("base64") }, { model: DEFAULT_VISION_MODEL, onUsage });
      if (reading.multiplePills || reading.pillVisible === false) return null; // Really touching pills, or nothing: stays "Not read".
      const second = await secondRead(reading, crop, reader, budget, resolved, onUsage);
      let doubleRead: DoubleRead | undefined;
      if (second) { reading = second.reading; doubleRead = second.evidence; }
      return { i, crop, reading, doubleRead };
    } catch (error) { if (error instanceof BottleQuotaError) throw error; return null; }
  });
  const pills: BottlePill[] = [];
  for (const r of read) {
    if (!r) continue;
    const result = await runResolvedCheck(label, r.reading, resolved), outline = segmented.clumpOutlines?.[r.i];
    const pill = withDoubleRead({ number: firstNumber + pills.length + 1, box: clumps[r.i].box, result, fromRegion: true, ...(outline ? { outline } : {}) }, r.doubleRead);
    pills.push(await confirmNearMiss(pill, async () => r.crop, reader, budget, onUsage));
    clumps[r.i] = { ...clumps[r.i], readAsOne: true };
  }
  return { pills, segmented: { ...segmented, clumps, boxes: [...segmented.boxes, ...pills.map((p) => p.box)] } };
}

/**
 * Reads up to MAX_PILES touching regions with the pile reader and checks every pill it reports with the same engine.
 * A failed pile read leaves that region "Not read". Pile pills are numbered after the separate pills.
 */
async function readPiles(photo: Buffer, label: LabelReading, segmented: SegmentedBottle, firstNumber: number, resolved: ResolvedLabelData, dependencies: BottleDependencies, onUsage: ReadOptions["onUsage"], budget: ReadingBudget): Promise<{ pills: BottlePill[]; clumps: BottleClump[] }> {
  const clumps = segmented.clumps.map((c) => ({ ...c })), order = pilesToRead(clumps);
  if (!order.length) return { pills: [], clumps };
  const reader = dependencies.readPillGroup ?? readPillGroup;
  const groups = await Promise.all(order.map(async (i) => {
    try { return await reader(await pileCrop(photo, clumps[i].box), { model: DEFAULT_VISION_MODEL, onUsage }); }
    catch (error) { if (error instanceof BottleQuotaError) throw error; return null; } // That region stays "Not read".
  }));
  const taken = [...segmented.boxes], found: PilePill[] = [];
  order.forEach((i, k) => {
    const group = groups[k];
    if (!group) return;
    const mapped = pilePills(group, i, clumps[i].box, taken);
    // Never more than the 20-pill bottle limit in all; a pile cut short counts as not fully read (UNSURE).
    const pills = mapped.pills.slice(0, Math.max(0, MAX_BOTTLE_PILLS - firstNumber - found.length));
    // A pile read that found no new pill leaves the region "Not read".
    if (!pills.length) return;
    clumps[i] = { ...clumps[i], pile: { ...mapped.pile, read: pills.length } };
    taken.push(...pills.map((p) => p.box)); found.push(...pills);
  });
  found.sort(readingOrder);
  const single = dependencies.readPill ?? readPill;
  const pills = await mapFive(found, async (p, k): Promise<BottlePill> => {
    let reading = p.reading, doubleRead: DoubleRead | undefined;
    if (!p.partlyHidden) {
      const second = await secondRead(reading, Buffer.from((await pileCrop(photo, p.box)).base64, "base64"), single, budget, resolved, onUsage);
      if (second) { reading = second.reading; doubleRead = second.evidence; }
    }
    const result = await runResolvedCheck(label, reading, resolved);
    const pill = withDoubleRead({ number: firstNumber + k + 1, box: p.box, result, fromPile: true, ...(p.guessed ? { boxGuessed: true } : {}) }, doubleRead);
    return confirmNearMiss(pill, async () => Buffer.from((await pileCrop(photo, p.box)).base64, "base64"), single, budget, onUsage);
  });
  return { pills, clumps };
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
  try { segmented = dependencies.prepared ?? await segmentBottle(bottleImage); } catch (error) {
    if (!(error instanceof SegmentationError)) throw error;
    send({ type: "step", step: 1, state: "failed" });
    send({ type: "retake", code: error.code, message: error.message });
    return null;
  }
  send({ type: "step", step: 1, state: "done" });
  send({ type: "segmented", boxes: segmented.boxes, image: segmented.image });
  const tips = captureCoaching(segmented);
  if (tips.length && !dependencies.checkAnyway) { send({ type: "coaching", tips }); return null; }
  const plan = planFollowUp(previous, segmented);
  const read = plan.mode === "fresh" ? segmented.crops.map((_, i) => i) : plan.reread;
  // A fresh full check reads piles too; a targeted re-read leaves touching pills circled (never green).
  const planned = read.length + (plan.mode === "fresh" ? oneRegionsToRead(segmented.clumps, read.length).length + PILE_READ_UNITS * pilesToRead(segmented.clumps).length : 0);
  await reserveRemaining(planned);
  const budget = readingBudget(planned, reserveRemaining);
  const resolved = await resolveLabelData(previous.label);
  let pills = await readAndCheck(previous.label, segmented, read, plan.mode === "fresh" ? new Map() : plan.reused, resolved, send, dependencies, onUsage, budget, plan.mode === "reread", plan.mode === "reread" ? plan.prior : new Map());
  let clumps = segmented.clumps;
  if (plan.mode === "fresh") {
    const regions = await readOneRegions(previous.label, segmented, pills.length, resolved, dependencies, onUsage, budget);
    const piled = await readPiles(bottleImage, previous.label, regions.segmented, pills.length + regions.pills.length, resolved, dependencies, onUsage, budget);
    pills = annotatePills([...pills, ...regions.pills, ...piled.pills]); clumps = piled.clumps;
  }
  const unresolvedRegions = plan.mode === "reread" ? plan.unresolvedRegions : (previous.unresolvedRegions ?? 0) + (previous.clumps?.filter(c => !c.readAsOne).length ?? 0);
  // Geometry is enough to guide a flip, never to certify a new green bottle. Read all carried pills before green.
  const carriedIndices = pills.flatMap((p, i) => p.carried ? [i] : []);
  if (carriedIndices.length && !unresolvedRegions && !clumps.some(c => !c.readAsOne) && pills.filter(p => !p.carried).every(p => p.result.verdict === "MATCH" || p.result.verdict === "SAME_MEDICINE_DIFFERENT_MAKER")) {
    budget.planned += carriedIndices.length;
    await budget.reserve(budget.planned + budget.extras);
    const kept = new Map(pills.flatMap((p, i) => p.carried ? [] : [[i, p] as [number, BottlePill]]));
    const verified = await readAndCheck(previous.label, segmented, carriedIndices, new Map(), resolved, send, dependencies, onUsage, budget);
    pills = annotatePills(verified.map((p, i) => kept.get(i) ?? { ...p, reread: true }));
    read.push(...carriedIndices);
  }
  pills = applyConsensus(pills, clumps, unresolvedRegions);
  const reread = [...new Set(read)].sort((a, b) => a - b).map((i) => i + 1), reused = segmented.boxes.length - reread.length;
  const note = plan.mode === "fresh" ? plan.reason
    : !reread.length ? `No new readings were made. All ${reused} earlier readings remain unconfirmed in this photo.`
    : `We read ${reread.length === 1 ? "pill" : "pills"} ${listNumbers(reread)} again and kept the other ${reused} ${reused === 1 ? "reading" : "readings"} as unconfirmed history from your first photo.`;
  return { kind: "bottle", label: previous.label, pills, clumps: clumps, decision: unresolvedRegions && decideBottle(pills, clumps).verdict !== "MISMATCH" ? { ...decideBottle(pills, clumps), verdict: "UNSURE", title: "A circled region from an earlier photo is still unaccounted for.", instruction: "We cannot finish this bottle check. Put every pill back in view and start a new check.", asks: [], next: undefined } : decideBottle(pills, clumps), unresolvedRegions, image: segmented.image, checkedAt: new Date().toISOString(), elapsedMs: Math.round(performance.now() - started), usage, followUp: { mode: plan.mode, reread, reused, note } };
}

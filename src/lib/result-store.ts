import { getRedis, key } from "@/lib/redis";
import type { CheckResult } from "@/lib/check-service";
import type { Explanation } from "@/lib/ai/guard";

export type StoredResult = { result: CheckResult; explanation: Explanation; createdAt: string };
const memory = new Map<string, StoredResult>();
const RESULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function pruneExpired(now = Date.now()) {
  for (const [id, value] of memory) if (now - Date.parse(value.createdAt) >= RESULT_TTL_MS) memory.delete(id);
}

export async function saveResult(value: Omit<StoredResult, "createdAt">) {
  const id = crypto.randomUUID();
  const stored = { ...value, createdAt: new Date().toISOString() };
  pruneExpired();
  memory.set(id, stored);
  const redis = getRedis();
  if (redis) {
    try { await redis.set(key(`result:${id}`), stored, { ex: 7 * 24 * 60 * 60 }); } catch { /* local fallback remains usable */ }
  }
  return id;
}

export async function getResult(id: string) {
  pruneExpired();
  const local = memory.get(id);
  if (local) return local;
  const redis = getRedis();
  if (!redis) return null;
  try { return await redis.get<StoredResult>(key(`result:${id}`)); } catch { return null; }
}

export function clearResultMemoryForTests() { memory.clear(); }

// Bottle results use a separate discriminator, preserving the original one-pill storage contract.
export type StoredBottleResult = { kind: "bottle"; result: import("./bottle/types").BottleResult; createdAt: string };
const bottleMemory = new Map<string, StoredBottleResult>();

export async function saveBottleResult(value: import("./bottle/types").BottleResult) {
  const id = crypto.randomUUID();
  // Allow-list the serialized result. Request-local crop buffers/photos cannot enter the store.
  const safeLabel = (label: CheckResult["label"]) => ({ ndc: label.ndc, drugName: label.drugName, strength: label.strength, form: label.form, pharmacyName: label.pharmacyName, directions: label.directions, isPrescriptionLabel: label.isPrescriptionLabel, confidence: label.confidence ? { drugName: label.confidence.drugName, strength: label.confidence.strength, ndc: label.confidence.ndc, form: label.confidence.form } : undefined });
  const safePill = (pill: CheckResult["pill"]) => ({ imprintSides: pill.imprintSides, imprintConfidence: pill.imprintConfidence, colors: pill.colors, colorConfidence: pill.colorConfidence, shape: pill.shape, shapeConfidence: pill.shapeConfidence, form: pill.form, guess: pill.guess ? { drugName: pill.guess.drugName, strength: pill.guess.strength } : pill.guess, pillVisible: pill.pillVisible, multiplePills: pill.multiplePills, photoProblems: pill.photoProblems, scored: pill.scored, viewCount: pill.viewCount, viewConflict: pill.viewConflict });
  const safeCheck = (r: CheckResult): CheckResult => ({
    verdict: r.verdict, expected: r.expected, expectedIsTypical: r.expectedIsTypical,
    matchedProduct: r.matchedProduct, identifiedAs: r.identifiedAs, labelTitle: r.labelTitle,
    features: r.features, evidence: r.evidence, reasons: r.reasons, productsCompared: r.productsCompared,
    matchingListings: r.matchingListings, identifiedListings: r.identifiedListings,
    label: safeLabel(r.label), pill: safePill(r.pill), labelProduct: r.labelProduct, labels: r.labels,
    checkedAt: r.checkedAt, timings: r.timings, ...(r.highlight ? { highlight: r.highlight } : {}),
  });
  const result: import("./bottle/types").BottleResult = {
    kind: "bottle", label: safeLabel(value.label), decision: { verdict: value.decision.verdict, title: value.decision.title, instruction: value.decision.instruction, matched: value.decision.matched, unreadable: value.decision.unreadable, flagged: value.decision.flagged },
    image: { width: value.image.width, height: value.image.height },
    pills: value.pills.map((p) => ({ number: p.number, box: { x: p.box.x, y: p.box.y, width: p.box.width, height: p.box.height }, result: safeCheck(p.result), ...(p.appearanceWarning ? { appearanceWarning: p.appearanceWarning } : {}) })),
    checkedAt: value.checkedAt, elapsedMs: value.elapsedMs, usage: value.usage.map((u) => ({ model: u.model, inputTokens: u.inputTokens, outputTokens: u.outputTokens, estimatedUsd: u.estimatedUsd })),
  };
  const stored: StoredBottleResult = JSON.parse(JSON.stringify({ kind: "bottle", result, createdAt: new Date().toISOString() }));
  for (const [k, v] of bottleMemory) if (Date.now() - Date.parse(v.createdAt) >= RESULT_TTL_MS) bottleMemory.delete(k);
  bottleMemory.set(id, stored);
  const redis = getRedis();
  if (redis) { try { await redis.set(key(`bottle-result:${id}`), stored, { ex: RESULT_TTL_MS / 1000 }); } catch { /* local fallback */ } }
  return id;
}
export async function getBottleResult(id: string) {
  const local = bottleMemory.get(id);
  if (local && Date.now() - Date.parse(local.createdAt) < RESULT_TTL_MS) return local;
  bottleMemory.delete(id);
  const redis = getRedis();
  if (!redis) return null;
  try { return await redis.get<StoredBottleResult>(key(`bottle-result:${id}`)); } catch { return null; }
}

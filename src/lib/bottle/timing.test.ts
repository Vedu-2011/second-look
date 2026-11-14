// Phase 11g: a 17-pill photo must finish well inside the function limit. Free: readers are mocked with a fixed latency.
// "Read rounds" = time with at least one read in flight ÷ latency (segmentation CPU, which varies with machine load, is
// left out). Real time ≈ rounds × a real read (~5–10 s) + a few seconds of segmentation. Numbers go in the handoff.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { SAMPLE_RESULTS } from "@/lib/sample-results";
import type { LabelReading, PillReading } from "@/lib/verdict-engine";
import { scene } from "./test-scenes";

vi.mock("@/lib/check-service", () => ({ resolveLabelData: vi.fn(async () => ({})), runResolvedCheck: vi.fn() }));
const { runResolvedCheck } = await import("@/lib/check-service");
const { runBottleCheck } = await import("./check-bottle");
const source = SAMPLE_RESULTS[0].result;
const LATENCY = 200;
beforeEach(() => {
  vi.mocked(runResolvedCheck).mockImplementation(async (label: LabelReading, pill: PillReading) => ({ ...structuredClone(source), label, pill, verdict: "MATCH" }));
});

async function timed(photo: Buffer) {
  let inFlight = 0, peak = 0, reads = 0, busy = 0, since = 0;
  const slow = async <T>(value: T) => {
    if (inFlight++ === 0) since = performance.now();
    reads++; peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, LATENCY));
    if (--inFlight === 0) busy += performance.now() - since;
    return value;
  };
  const readPill = vi.fn(async () => slow<PillReading>({ ...source.pill, imprintConfidence: 0.9, multiplePills: false, pillVisible: true }));
  const readPillGroup = vi.fn(async () => slow({ pills: [], pileCount: 2, countConfidence: 0.9, somePillsMayBeHidden: false }));
  const started = performance.now();
  const result = await runBottleCheck({ mediaType: "image/png", base64: "" }, photo, async () => {}, () => {}, { label: source.label, readPill, readPillGroup, checkAnyway: true });
  const ms = performance.now() - started;
  return { result: result!, ms, reads, peak, rounds: busy / LATENCY };
}

describe("a 17-pill photo finishes well inside the limit", () => {
  it("reads at most 5 at a time, in a handful of rounds (synthetic 17-pill scene)", async () => {
    const t = await timed(await scene(17));
    console.info(`17-pill scene: ${t.result.pills.length} pills, ${t.reads} reads, peak ${t.peak} in flight, ${t.rounds.toFixed(1)} read-rounds (${Math.round(t.ms)} ms wall at ${LATENCY} ms/read)`);
    expect(t.result.pills).toHaveLength(17);
    expect(t.peak).toBeLessThanOrEqual(5);
    // 17 reads, 5 at a time = 4 rounds. At a slow real read (10 s) that is ~40 s, far under the 300 s maxDuration.
    expect(t.rounds).toBeLessThan(6);
  }, 30000);
  it("the real user-test pour (separate pills, one-pill regions and a pile) stays a handful of rounds too", async () => {
    const t = await timed(await readFile("test-images/real/extra/user-test-ibuprofen-tylenol.jpg"));
    console.info(`user-test pour: ${t.result.pills.length} pills, ${t.reads} reads, peak ${t.peak} in flight, ${t.rounds.toFixed(1)} read-rounds (${Math.round(t.ms)} ms wall)`);
    expect(t.peak).toBeLessThanOrEqual(5);
    expect(t.rounds).toBeLessThan(6);
  }, 30000);
});

// Phase 11e (a): a "touching" region about one pill in size is read with the single-pill reader (1 unit).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { SAMPLE_RESULTS } from "@/lib/sample-results";
import type { LabelReading, PillReading } from "@/lib/verdict-engine";
import { scene } from "./test-scenes";
import type { BottleClump, BottleResult } from "./types";

vi.mock("@/lib/check-service", () => ({ resolveLabelData: vi.fn(async () => ({})), runResolvedCheck: vi.fn() }));
const { runResolvedCheck } = await import("@/lib/check-service");
const { runBottleCheck } = await import("./check-bottle");
const { segmentBottle, ONE_PILL_REGION, oneSizedRegion } = await import("./segment");
const { oneRegionsToRead, pilesToRead } = await import("./pile");
const { planFollowUp } = await import("./match-positions");
const { applyConsensus } = await import("./consensus");
const source = SAMPLE_RESULTS[0].result;
const read = (extra: Partial<PillReading> = {}): PillReading => ({ ...source.pill, imprintConfidence: 0.9, multiplePills: false, pillVisible: true, ...extra });

beforeEach(() => {
  vi.mocked(runResolvedCheck).mockImplementation(async (label: LabelReading, pill: PillReading) => ({ ...structuredClone(source), label, pill, verdict: pill.pillVisible === false ? "UNSURE" : "MATCH" }));
});
async function run(regions: { relativeArea: number }[], single: (n: number) => PillReading | Error) {
  const photo = await scene(3), base = await segmentBottle(photo);
  const clumps: BottleClump[] = regions.map((r, i) => ({ kind: "touching", box: { x: 0.05 + i * 0.15, y: 0.7, width: 0.1, height: 0.12 }, relativeArea: r.relativeArea }));
  const crop = base.crops[0];
  const prepared = { ...base, clumps, clumpCrops: regions.map((r) => oneSizedRegion(r.relativeArea) ? crop : null), clumpOutlines: regions.map(() => null) };
  let regionReads = 0;
  const readPill = vi.fn(async (image: { base64: string }) => {
    if (image.base64 === crop.toString("base64") && readPill.mock.calls.length > 3) { const r = single(regionReads++); if (r instanceof Error) throw r; return r; }
    return read();
  });
  const readPillGroup = vi.fn(async () => ({ pills: [], pileCount: 0, countConfidence: 0.9, somePillsMayBeHidden: false }));
  const reserved: number[] = [];
  const result = await runBottleCheck({ mediaType: "image/png", base64: "" }, photo, async (n) => { reserved.push(n); }, () => {}, { prepared, label: source.label, readPill, readPillGroup, checkAnyway: true });
  return { result: result!, readPill, readPillGroup, reserved };
}

describe("one-pill 'touching' regions", () => {
  it("are read as one pill (1 unit), numbered after the separate pills, and can make the bottle green", async () => {
    const { result, readPillGroup, reserved } = await run([{ relativeArea: 1.1 }], () => read());
    expect(reserved[0]).toBe(3 + 1); expect(readPillGroup).not.toHaveBeenCalled();
    expect(result.pills).toHaveLength(4); expect(result.pills[3]).toMatchObject({ number: 4, fromRegion: true });
    expect(result.clumps![0].readAsOne).toBe(true);
    expect(result.decision.verdict).toBe("MATCH");
  });
  it.each([["the reader sees several pills", read({ multiplePills: true })], ["the reader sees no pill", read({ pillVisible: false })], ["the read fails", new Error("refused")]])("stay 'Not read' when %s, never green", async (_name, answer) => {
    const { result } = await run([{ relativeArea: 1.0 }], () => answer);
    expect(result.pills).toHaveLength(3); expect(result.clumps![0].readAsOne).toBeUndefined();
    expect(["MATCH", "LOOKS_RIGHT"]).not.toContain(result.decision.verdict);
  });
  it("bigger regions go to the pile reader, and one-pill regions don't use a pile slot", async () => {
    // 0.2 is a speck, not "about one pill": never single-read and never pile-read (it stays "Not read").
    const clumps: BottleClump[] = [2, 1.2, 3, 2.5, 4, 0.9, 0.2].map((relativeArea, i) => ({ kind: "touching", box: { x: i * 0.15, y: 0, width: 0.1 + relativeArea * 0.01, height: 0.1 }, relativeArea }));
    expect(oneRegionsToRead(clumps)).toEqual([1, 5]);
    expect(pilesToRead(clumps)).toEqual([4, 2, 3]);
    expect(pilesToRead(clumps.filter((c) => c.relativeArea! !== 4 && c.relativeArea! !== 3))).toEqual([2, 0]);
    const { readPillGroup, reserved } = await run([{ relativeArea: 2 }, { relativeArea: 1.2 }], () => read());
    expect(readPillGroup).toHaveBeenCalledTimes(1); expect(reserved[0]).toBe(3 + 1 + 5);
  });
  it("the segmenter measures every touching region and crops only the one-pill-sized ones (real user-test pour)", async () => {
    const r = await segmentBottle(await readFile("test-images/real/extra/user-test-ibuprofen-tylenol.jpg"));
    r.clumps.forEach((c, i) => {
      if (c.kind !== "touching") return;
      expect(c.relativeArea).toBeGreaterThan(0);
      expect(Boolean(r.clumpCrops?.[i])).toBe(oneSizedRegion(c.relativeArea));
      expect(Boolean(r.clumpOutlines?.[i])).toBe(oneSizedRegion(c.relativeArea));
      expect(oneSizedRegion(c.relativeArea)).toBe(c.relativeArea! >= 0.5 && c.relativeArea! <= ONE_PILL_REGION);
    });
  }, 20000);
});

describe("codex review fixes", () => {
  it("never reads regions past the 20-pill bottle limit", () => {
    const clumps: BottleClump[] = [1, 1.1, 0.9].map((relativeArea, i) => ({ kind: "touching", box: { x: i * 0.2, y: 0, width: 0.1, height: 0.1 }, relativeArea }));
    expect(oneRegionsToRead(clumps, 0)).toEqual([0, 1, 2]);
    expect(oneRegionsToRead(clumps, 19)).toEqual([0]);
    expect(oneRegionsToRead(clumps, 20)).toEqual([]);
    expect(pilesToRead(clumps)).toEqual([]); // capped regions still never take a pile slot
  });
  it("a region read as one pill is not an open question in the next photo, and doesn't block consensus", () => {
    const pills = Array.from({ length: 3 }, (_, i) => ({ number: i + 1, box: { x: 0.1 + i * 0.3, y: 0.4, width: 0.1, height: 0.07 }, result: source, features: { length: 120, width: 60, aspect: 2, area: 0.007, relativeArea: 1, lab: [91, 2.6, 17] as [number, number, number] } }));
    const readAsOne: BottleClump = { kind: "touching", box: pills[2].box, relativeArea: 1, readAsOne: true };
    const previous: BottleResult = { kind: "bottle", label: source.label, image: { width: 1200, height: 1000 }, checkedAt: "", elapsedMs: 0, usage: [], pills, clumps: [readAsOne],
      decision: { verdict: "FACE_DOWN", title: "", instruction: "", matched: 2, unreadable: 1, flagged: [], asks: [1], next: "flip" } };
    const plan = planFollowUp(previous, { image: previous.image, boxes: pills.map((p) => p.box), features: pills.map((p) => p.features), clumps: [] });
    expect(plan.mode).toBe("reread");
    if (plan.mode === "reread") expect(plan.unresolvedRegions).toBe(0);
    const unread: BottleClump = { ...readAsOne, readAsOne: undefined };
    const blocked = planFollowUp({ ...previous, clumps: [unread] }, { image: previous.image, boxes: pills.map((p) => p.box), features: pills.map((p) => p.features), clumps: [] });
    expect(blocked.mode).toBe("reread"); if (blocked.mode === "reread") expect(blocked.unresolvedRegions).toBe(1);
    const consensusInput = pills.map((p) => ({ ...p, result: { ...p.result, verdict: "UNSURE" as const } }));
    expect(applyConsensus(consensusInput, [readAsOne])).toEqual(applyConsensus(consensusInput, []));
  });
});

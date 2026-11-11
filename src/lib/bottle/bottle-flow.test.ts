// End to end without paid calls: real segmentation of drawn photos, the real verdict engine, FDA data from the
// recorded fixture, and pill readings recorded live from Vedhanth's real photos (__fixtures__/real-readings.json).
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageInput } from "@/lib/ai/client";
import type { PillReading } from "@/lib/verdict-engine";
import recorded from "./__fixtures__/real-readings.json";
import { layout, type ScenePill } from "./test-scenes";

vi.mock("@/lib/fda/dailymed", () => ({ labelMeta: vi.fn(async () => null) }));
vi.mock("@/lib/fda/rxnav", async (original) => {
  const real = (await import("@/lib/fda/__fixtures__/real-demo.json")).default as unknown as { products: Record<string, unknown>; groups: Record<string, { generic: { rxcui: string }; members: { rxcui: string }[] }> };
  return {
    ...(await original<typeof import("@/lib/fda/rxnav")>()),
    lookupNdc: async (ndc: string) => ({ product: real.products[ndc] ?? null, ambiguous: false }),
    drugGroup: async (rxcui: string) => Object.values(real.groups).find((g) => g.generic.rxcui === rxcui || g.members.some((m) => m.rxcui === rxcui)) ?? null,
    approximateTerm: async (term: string) => (/amoxicillin/i.test(term) ? real.groups["308192"].generic : /metformin/i.test(term) ? real.groups["861004"].generic : null),
  };
});
const { runBottleCheck, runBottleFollowUp } = await import("./check-bottle");

const LABEL = { ndc: "70010-065", drugName: "Metformin HCl", strength: "1,000 mg", form: "tablet" };
const WHITE = "#f2f0ea", FACE_DOWN = "#eeeeee", AMOXICILLIN = "#efe2b8";
const spot = (i: number) => ({ cx: 160 + (i % 5) * 220, cy: 300 + Math.floor(i / 5) * 360 });
/** Ten pills in two rows; `change` restyles some of them. Colors tell the stand-in reader which reading to return. */
const spread = (change: Record<number, Partial<ScenePill>> = {}, move: (p: ScenePill) => ScenePill = (p) => p) =>
  layout(Array.from({ length: 10 }, (_, i) => move({ ...spot(i), rx: 60, ry: 33, color: WHITE, ...change[i + 1] })), { gradient: true });

let readings: Record<string, PillReading> = {};
const reads = vi.fn(async (image: ImageInput): Promise<PillReading> => {
  const crop = sharp(Buffer.from(image.base64, "base64")), { width = 0, height = 0 } = await crop.metadata();
  const { data } = await crop.extract({ left: Math.floor(width / 2), top: Math.floor(height / 2), width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
  const hex = `#${[...data.subarray(0, 3)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  if (!readings[hex]) throw new Error(`No reading for ${hex}`);
  return structuredClone(readings[hex]);
});
const deps = () => ({ label: LABEL, readPill: reads });
const check = async (photo: Buffer) => (await runBottleCheck({ mediaType: "image/jpeg", base64: "" }, photo, async () => {}, () => {}, deps()))!;
beforeEach(() => { reads.mockClear(); readings = { [WHITE]: recorded.g12 as PillReading }; });

describe("a wrong pill is caught from either side (recorded readings)", () => {
  it('"93" face up among G 12 metformin: the bottle is red', async () => {
    readings[AMOXICILLIN] = recorded.amoxicillin93 as PillReading;
    const result = await check(await spread({ 7: { color: AMOXICILLIN, rx: 55, ry: 30 } }));
    expect(result.pills.filter((p) => p.result.verdict === "MATCH")).toHaveLength(9);
    expect(result.decision).toMatchObject({ verdict: "MISMATCH", title: "Pill 7 doesn't match your label." });
  });
  it('"2263" face up, read clearly: the bottle is red too; naming the medicine waits for both sides', async () => {
    readings[AMOXICILLIN] = { ...(recorded.amoxicillin2263LowConfidence as PillReading), imprintSides: ["2263"], imprintConfidence: 0.85 };
    const result = await check(await spread({ 7: { color: AMOXICILLIN, rx: 55, ry: 30 } }));
    expect(result.decision.verdict).toBe("MISMATCH");
    expect(result.pills[6].result.identifiedAs).toBeNull();
    expect(result.pills[6].result.reasons.join(" ")).toContain("Turn the pill over");
  });
  it('the real "22 63" reading at 0.6 confidence stays "can\'t tell", and the look-alike check still singles it out', async () => {
    readings[AMOXICILLIN] = recorded.amoxicillin2263LowConfidence as PillReading;
    const result = await check(await spread({ 5: { color: AMOXICILLIN, rx: 55, ry: 30 } }));
    expect(result.pills[4].result.verdict).toBe("UNSURE");
    expect(result.pills[4].odd).toContain("different");
    expect(result.decision).toMatchObject({ verdict: "WARNING", title: "Pill 5 looks different from the others.", instruction: "Flip just that one and snap again.", asks: [5] });
  });
});

describe("flip and snap again", () => {
  it("reads the flipped pill first, then verifies every carried imprint before green", async () => {
    readings[FACE_DOWN] = { ...(recorded.g12 as PillReading), imprintSides: [], imprintConfidence: 0 };
    const first = await check(await spread({ 4: { color: FACE_DOWN } }));
    expect(first.decision).toMatchObject({ verdict: "FACE_DOWN", asks: [4] });
    reads.mockClear();
    // Same spread, phone a little closer and to the side; pill 4 flipped where it was.
    const second = await runBottleFollowUp(first, await spread({}, (p) => ({ ...p, cx: p.cx * 1.04 + 25, cy: p.cy * 1.04 - 30 })), async () => {}, () => {}, deps());
    expect(reads).toHaveBeenCalledTimes(10);
    expect(second!.followUp).toMatchObject({ mode: "reread", reread: [1,2,3,4,5,6,7,8,9,10], reused: 0 });
    expect(second!.decision).toMatchObject({ verdict: "MATCH", title: "All 10 pills we found match your label." });
    expect(second!.pills[3].reread).toBe(true);
  });
  it("if the pills moved, checks every pill again and says so", async () => {
    readings[FACE_DOWN] = { ...(recorded.g12 as PillReading), imprintSides: [], imprintConfidence: 0 };
    const first = await check(await spread({ 4: { color: FACE_DOWN } }));
    reads.mockClear();
    const reshuffled = await spread({}, (p) => (p.cx === spot(0).cx && p.cy === spot(0).cy ? { ...p, cx: 600, cy: 120 } : p));
    const second = await runBottleFollowUp(first, reshuffled, async () => {}, () => {}, deps());
    expect(second!.followUp).toMatchObject({ mode: "fresh", note: "The pills moved too much to match them with your first photo, so we checked every pill again." });
    expect(reads).toHaveBeenCalledTimes(10);
  });
  it("reads separated pills first, then verifies all imprints before green", async () => {
    const touching = await layout([...Array.from({ length: 8 }, (_, i) => ({ ...spot(i), rx: 60, ry: 33, color: WHITE })), { cx: 500, cy: 880, rx: 60, ry: 33, color: WHITE }, { cx: 590, cy: 880, rx: 60, ry: 33, color: WHITE }], { gradient: true });
    const first = await check(touching);
    expect(first.clumps).toEqual([expect.objectContaining({ kind: "touching" })]);
    expect(first.decision).toMatchObject({ verdict: "UNSURE", matched: 8, next: "nudge" });
    reads.mockClear();
    const apart = await layout([...Array.from({ length: 8 }, (_, i) => ({ ...spot(i), rx: 60, ry: 33, color: WHITE })), { cx: 450, cy: 880, rx: 60, ry: 33, color: WHITE }, { cx: 640, cy: 880, rx: 60, ry: 33, color: WHITE }], { gradient: true });
    const second = await runBottleFollowUp(first, apart, async () => {}, () => {}, deps());
    expect(reads).toHaveBeenCalledTimes(10);
    expect(second!.followUp).toMatchObject({ mode: "reread", reread: [1,2,3,4,5,6,7,8,9,10], reused: 0 });
    expect(second!.decision.verdict).toBe("MATCH");
  });
});


describe("fresh review regressions", () => {
  it("a same-looking replacement is read instead of inheriting an old MATCH", async () => {
    readings[FACE_DOWN] = { ...(recorded.g12 as PillReading), imprintSides: [], imprintConfidence: 0 };
    const first = await check(await spread({ 4: { color: FACE_DOWN } }));
    reads.mockClear();
    // Pill 1 replaced by an indistinguishable silhouette, but its actual imprint differs.
    reads.mockImplementationOnce(async () => structuredClone(recorded.g12 as PillReading))
      .mockImplementationOnce(async () => structuredClone(recorded.amoxicillin93 as PillReading));
    const second = await runBottleFollowUp(first, await spread(), async () => {}, () => {}, deps());
    expect(reads).toHaveBeenCalledTimes(10);
    expect(second!.decision.verdict).toBe("MISMATCH");
    expect(second!.pills[0].result.verdict).toBe("MISMATCH");
  });
  it("a removed circled cutoff never resolves the old bottle to green, even on another follow-up", async () => {
    const first = await check(await spread());
    first.clumps = [{ kind: "cutoff", box: { x: 0, y: .85, width: .04, height: .05 } }];
    first.decision = { ...first.decision, verdict: "UNSURE", next: "nudge" };
    const second = await runBottleFollowUp(first, await spread(), async () => {}, () => {}, deps());
    expect(second!.unresolvedRegions).toBe(1); expect(second!.decision.verdict).toBe("UNSURE");
    const third = await runBottleFollowUp(second!, await spread(), async () => {}, () => {}, deps());
    expect(third!.unresolvedRegions).toBe(1); expect(third!.decision.verdict).not.toBe("MATCH");
  });
  it("keeps red while combining both sides to identify the requested pill only", async () => {
    readings[AMOXICILLIN] = recorded.amoxicillin93 as PillReading;
    const photo = await spread({ 5: { color: AMOXICILLIN, rx: 55, ry: 30 } });
    const first = await check(photo);
    expect(first.decision).toMatchObject({ verdict: "MISMATCH", asks: [5], next: "flip" });
    reads.mockClear();
    readings[AMOXICILLIN] = { ...(recorded.amoxicillin93 as PillReading), imprintSides: ["2263"], imprintConfidence: .9 };
    const second = await runBottleFollowUp(first, photo, async () => {}, () => {}, deps());
    expect(reads).toHaveBeenCalledTimes(1); expect(second!.followUp?.reread).toEqual([5]);
    expect(second!.pills[4].result.pill.imprintSides).toEqual(["93", "2263"]);
    expect(second!.pills[4].result.identifiedAs?.title).toContain("Amoxicillin");
    expect(second!.decision.verdict).toBe("MISMATCH");
    expect(second!.pills[0]).toMatchObject({ carried: true, result: { verdict: "UNSURE" } });
  });
});

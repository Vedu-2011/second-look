// Phase 12 §0: after "Flip and snap again" every pill found again keeps its first-photo number (Vedhanth's demo: the
// "93" was pill 4, then pill 7 after the flip). No paid calls: real segmentation, recorded readings, recorded FDA data.
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageInput } from "@/lib/ai/client";
import { SAMPLE_RESULTS } from "@/lib/sample-results";
import type { PillReading } from "@/lib/verdict-engine";
import recorded from "./__fixtures__/real-readings.json";
import { keepNumbers } from "./match-positions";
import { segmentBottle } from "./segment";
import { layout, type ScenePill } from "./test-scenes";
import type { BottleResult } from "./types";

vi.mock("@/lib/redis", () => ({ getRedis: () => null, key: (v: string) => "sl:" + v }));
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
const { saveBottleResult, getBottleResult } = await import("@/lib/result-store");

const LABEL = { ndc: "70010-065", drugName: "Metformin HCl", strength: "1,000 mg", form: "tablet" };
const G12 = recorded.g12 as PillReading, NINETY_THREE = recorded.amoxicillin93 as PillReading;

describe("Vedhanth's real metformin bottle (pills.jpg → pills-flipped.jpg)", () => {
  // The recorded readings go to the right crops: the yellowish amoxicillin is the most yellow silhouette.
  let byCrop = new Map<string, PillReading>();
  const learn = async (photo: Buffer) => {
    const s = await segmentBottle(photo), yellowest = s.features.reduce((best, f, i) => (f.lab[2] > s.features[best].lab[2] ? i : best), 0);
    s.crops.forEach((c, i) => byCrop.set(c.toString("base64"), i === yellowest ? NINETY_THREE : G12));
    return yellowest;
  };
  const reads = vi.fn(async (image: ImageInput) => { const r = byCrop.get(image.base64); if (!r) throw new Error("Unknown crop"); return structuredClone(r); });
  const deps = { label: LABEL, readPill: reads, checkAnyway: true };
  const ninetyThree = (r: BottleResult) => r.pills.find((p) => p.result.pill.imprintSides.includes("93"))!;
  /** The flipped photo with the phone turned 4° and a little closer: the segmenter now lists the 93 fourth. */
  const turnedAndCloser = async () => {
    const turned = sharp(await sharp(await sharp(await readFile("test-images/real/bottle/pills-flipped.jpg")).rotate().toBuffer()).rotate(-4, { background: "#7a7a7a" }).toBuffer());
    const { width = 0, height = 0 } = await turned.metadata(), w = Math.round(width * 0.8), h = Math.round(height * 0.8);
    return turned.extract({ left: Math.round((width - w) / 2), top: Math.round((height - h) / 2), width: w, height: h }).jpeg({ quality: 90 }).toBuffer();
  };
  let first: BottleResult;
  beforeEach(async () => {
    byCrop = new Map();
    const photo = await readFile("test-images/real/bottle/pills.jpg");
    await learn(photo);
    first = (await runBottleCheck({ mediaType: "image/jpeg", base64: "" }, photo, async () => {}, () => {}, deps))!;
    expect(first.decision).toMatchObject({ verdict: "MISMATCH", title: `Pill ${ninetyThree(first).number} doesn't match your label.` });
  });

  it("flipped in place: the 93 keeps its number and so does every other pill", async () => {
    const flipped = await readFile("test-images/real/bottle/pills-flipped.jpg");
    await learn(flipped);
    const after = (await runBottleFollowUp(first, flipped, async () => {}, () => {}, deps))!;
    expect(ninetyThree(after).number).toBe(ninetyThree(first).number);
    expect(after.pills.map((p) => p.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(after.decision.title).toBe(`Pill ${ninetyThree(first).number} doesn't match your label.`);
  });
  it("phone turned and closer: the segmenter's order changes, the numbers don't", async () => {
    const photo = await turnedAndCloser(), order = await learn(photo);
    expect(order + 1).not.toBe(ninetyThree(first).number); // Before phase 12 this pill would have been renumbered.
    const after = (await runBottleFollowUp(first, photo, async () => {}, () => {}, deps))!;
    expect(ninetyThree(after).number).toBe(ninetyThree(first).number);
    expect(after.pills.map((p) => p.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(after.decision.title).toBe(`Pill ${ninetyThree(first).number} doesn't match your label.`);
    // Every other pill sits where the same-numbered pill was in the first photo.
    for (const p of after.pills) expect(first.pills.find((q) => q.number === p.number)!.result.pill.imprintSides).toEqual(p.number === ninetyThree(first).number ? ["93"] : ["G 12"]);
  });
});

describe("keepNumbers", () => {
  const points = Array.from({ length: 10 }, (_, i) => ({ x: 160 + (i % 5) * 220, y: 300 + Math.floor(i / 5) * 360 }));
  const box = (p: { x: number; y: number }) => ({ x: (p.x - 60) / 1200, y: (p.y - 35) / 1000, width: 120 / 1200, height: 70 / 1000 });
  const image = { width: 1200, height: 1000 };
  const previous = (numbers = points.map((_, i) => i + 1), at = points, extra: Partial<BottleResult> = {}): BottleResult => ({ kind: "bottle", label: SAMPLE_RESULTS[0].result.label, image, checkedAt: "", elapsedMs: 0, usage: [],
    pills: at.map((p, i) => ({ number: numbers[i], box: box(p), result: SAMPLE_RESULTS[0].result })),
    decision: { verdict: "UNSURE", title: "", instruction: "", matched: 0, unreadable: 0, flagged: [] }, ...extra });
  const moved = (p: { x: number; y: number }) => ({ x: p.x * 1.05 + 30, y: p.y * 1.05 - 40 });

  it("a shifted, zoomed photo whose pills come out in another order keeps every number", () => {
    const order = [3, 7, 0, 9, 1, 5, 2, 8, 6, 4];
    expect(keepNumbers(previous(), { image, boxes: order.map((i) => box(moved(points[i]))) })).toEqual({ numbers: order.map((i) => i + 1), highest: 10, renumbered: false });
  });
  it("a new pill gets 11; the others keep theirs", () => {
    expect(keepNumbers(previous(), { image, boxes: [...points, { x: 600, y: 120 }].map(box) }).numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
  it("a removed pill's number is never given out again, even one photo later", () => {
    const without5 = points.filter((_, i) => i !== 4);
    const second = keepNumbers(previous(), { image, boxes: without5.map(box) });
    expect(second).toEqual({ numbers: [1, 2, 3, 4, 6, 7, 8, 9, 10], highest: 10, renumbered: false });
    // Then a pill is added where 5 was: it is new to this check, so it is 11.
    const third = keepNumbers(previous(second.numbers, without5, { highestNumber: second.highest }), { image, boxes: [...without5, points[4]].map(box) });
    expect(third.numbers).toEqual([1, 2, 3, 4, 6, 7, 8, 9, 10, 11]);
  });
  it("a fresh fallback where only a few pills line up still keeps those few numbers", () => {
    // Seven pills taken away, two new ones dropped in: three of ten still line up.
    const three = [points[0], points[1], points[2], { x: 1050, y: 930 }, { x: 560, y: 120 }];
    expect(keepNumbers(previous(), { image, boxes: three.map(box) })).toEqual({ numbers: [1, 2, 3, 11, 12], highest: 12, renumbered: false });
  });
  it("after a new pour, or when no pill lines up, the pills are numbered again", () => {
    expect(keepNumbers(previous(undefined, undefined, { decision: { ...previous().decision, next: "pour_again" } }), { image, boxes: points.map(box) })).toMatchObject({ renumbered: true, numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
    const elsewhere = Array.from({ length: 4 }, (_, i) => ({ x: 150 + i * 300, y: 960 }));
    expect(keepNumbers(previous(), { image, boxes: elsewhere.map(box) }).renumbered).toBe(true);
  });
});

describe("fresh full check after a follow-up that couldn't be matched pill for pill", () => {
  const WHITE = "#f2f0ea";
  const spot = (i: number) => ({ cx: 160 + (i % 5) * 220, cy: 300 + Math.floor(i / 5) * 360 });
  const spread = (move: (p: ScenePill, i: number) => ScenePill = (p) => p) => layout(Array.from({ length: 10 }, (_, i) => move({ ...spot(i), rx: 60, ry: 33, color: WHITE }, i)), { gradient: true });
  const reads = vi.fn(async () => structuredClone(G12));
  const deps = { label: LABEL, readPill: reads };
  it("keeps the numbers it can match, gives the moved pill 11, and doesn't say it renumbered", async () => {
    const first = (await runBottleCheck({ mediaType: "image/jpeg", base64: "" }, await spread(), async () => {}, () => {}, deps))!;
    const second = (await runBottleFollowUp(first, await spread((p, i) => (i === 0 ? { ...p, cx: 600, cy: 120 } : p)), async () => {}, () => {}, deps))!;
    expect(second.followUp).toMatchObject({ mode: "fresh", note: "The pills moved too much to match them with your first photo, so we checked every pill again." });
    expect(second.pills.map((p) => p.number)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(second.pills.find((p) => p.number === 11)!.box.y).toBeLessThan(0.2);
    expect(second.highestNumber).toBe(11);
    // The kept number survives storage, so the next follow-up continues from it.
    const id = await saveBottleResult(second);
    expect((await getBottleResult(id))?.result.highestNumber).toBe(11);
  });
  it("after a new pour, says it numbered the pills again", async () => {
    const first = (await runBottleCheck({ mediaType: "image/jpeg", base64: "" }, await spread(), async () => {}, () => {}, deps))!;
    first.decision = { ...first.decision, next: "pour_again" };
    const second = (await runBottleFollowUp(first, await spread(), async () => {}, () => {}, deps))!;
    expect(second.followUp?.note).toBe("You poured the pills again, so we checked every pill again. We numbered the pills again.");
  });
});

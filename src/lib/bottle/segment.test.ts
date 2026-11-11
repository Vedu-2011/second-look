import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MAX_BOTTLE_BYTES, segmentBottle } from "./segment";
import { deviations, oddOnesOut, referenceOf } from "./lookalike";
import { grid, layout, scene } from "./test-scenes";

describe("deterministic whole-bottle segmentation", () => {
  it.each(["white", "black", "#f6df89"])("finds every colored pill on %s", async (background) => {
    const found = await segmentBottle(await scene(9, { background, mixed: true }));
    expect(found.boxes).toHaveLength(9);
    expect(found.crops).toHaveLength(9);
    for (const b of found.boxes) { expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(1); expect(b.y + b.height).toBeLessThanOrEqual(1); }
  });
  it("tolerates low-amplitude wood-like texture", async () => {
    const input = await scene(6, { background: "#bc995f" });
    const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i++) data[i] = Math.max(0, Math.min(255, data[i] + Math.round(3 * Math.sin(Math.floor(i / 3) * 0.02))));
    const textured = await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer();
    expect((await segmentBottle(textured)).boxes).toHaveLength(6);
  });
  it("ignores tiny specks and retains stable row-major numbering", async () => {
    const found = await segmentBottle(await scene(9, { specks: true }));
    expect(found.boxes).toHaveLength(9);
    expect(found.boxes[1].x).toBeGreaterThan(found.boxes[0].x);
    expect(found.boxes[5].y).toBeGreaterThan(found.boxes[0].y);
  });
  it.each([2, 9])("circles a touching pair among %i pills instead of failing the photo, and never splits it", async (n) => {
    const found = await segmentBottle(await scene(n, { touching: true }));
    expect(found.clumps).toEqual([expect.objectContaining({ kind: "touching" })]);
    expect(found.boxes).toHaveLength(n - 2);
    expect(found.crops).toHaveLength(n - 2);
  });
  it("retains both a cutoff pill and ambiguous table-edge foreground as unchecked", async () => {
    const found = await segmentBottle(await layout([...grid().slice(0, 4), { cx: 8, cy: 820 }], { strip: "#7a5a3a" }));
    expect(found.boxes).toHaveLength(4);
    expect(found.clumps).toEqual([expect.objectContaining({ kind: "cutoff" }), expect.objectContaining({ kind: "cutoff" })]);
  });
  it("rejects no pills and 25 pills, and accepts exactly 20", async () => {
    await expect(segmentBottle(await scene(0))).rejects.toMatchObject({ code: "none" });
    await expect(segmentBottle(await scene(25))).rejects.toMatchObject({ code: "too_many" });
    expect((await segmentBottle(await scene(20))).boxes).toHaveLength(20);
  });
  it("finds pills through gradients and folds but conservatively circles foreground along the edge", async () => {
    const found = await segmentBottle(await layout(grid(), { gradient: true, folds: true, strip: "#7a5a3a" }));
    expect(found.boxes).toHaveLength(9);
    expect(found.clumps).toEqual([expect.objectContaining({ kind: "cutoff" })]);
  });
  it("finds pills on both halves of a two-tone surface", async () => {
    const twoTone = await sharp(Buffer.from(`<svg width="1200" height="1000"><rect width="600" height="1000" fill="white"/><rect x="600" width="600" height="1000" fill="#202024"/><ellipse cx="200" cy="300" rx="60" ry="32" fill="#3066b8"/><ellipse cx="300" cy="700" rx="60" ry="32" fill="#3066b8"/><ellipse cx="900" cy="300" rx="60" ry="32" fill="#f2f0ea"/><ellipse cx="950" cy="700" rx="60" ry="32" fill="#f2f0ea"/></svg>`)).png().toBuffer();
    expect((await segmentBottle(twoTone)).boxes).toHaveLength(4);
  });
  it("rejects a busy patterned background and huge clutter", async () => {
    await expect(segmentBottle(await layout(grid(), { stripes: true }))).rejects.toMatchObject({ code: "background" });
    const clutter = await sharp(Buffer.from('<svg width="1200" height="1000"><rect width="1200" height="1000" fill="white"/><rect x="100" y="100" width="900" height="700" fill="blue"/></svg>')).png().toBuffer();
    await expect(segmentBottle(clutter)).rejects.toMatchObject({ code: "touching_clutter" });
  });
  it("measures size and shape from the silhouette", async () => {
    const found = await segmentBottle(await layout([{ cx: 250, cy: 250, rx: 80, ry: 40 }, { cx: 650, cy: 250, rx: 80, ry: 40 }, { cx: 450, cy: 650, rx: 40, ry: 40, color: "#e8a040" }]));
    const [a, , round] = found.features;
    expect(a.aspect).toBeCloseTo(2, 1);
    expect(round.aspect).toBeCloseTo(1, 1);
    expect(round.relativeArea).toBeCloseTo(0.5, 1);
    expect(round.lab[2]).toBeGreaterThan(a.lab[2] + 20); // orange is far more yellow than off-white
  });
  it("keeps identical pills alike in a harsh scene (the noise the look-alike floors sit above)", async () => {
    // Tilt shrinks far rows up to 8%; shadows, folds, blur and JPEG on top.
    const pills = grid(Array.from({ length: 9 }, (_, i) => { const k = 1 - 0.04 * Math.floor(i / 3); return { angle: i * 17 - 60, rx: 60 * k, ry: 32 * k }; }));
    const harsh = await sharp(await layout([...pills.map((p) => ({ ...p, cx: p.cx + 7, cy: p.cy + 9, color: "#0c0c0e" })), ...pills], { gradient: true, folds: true, strip: "#7a5a3a" })).blur(1.6).jpeg({ quality: 65 }).toBuffer();
    const found = await segmentBottle(harsh);
    expect(found.boxes).toHaveLength(9);
    const ref = referenceOf(found.features), worst = found.features.map((f) => deviations(f, ref));
    expect(Math.max(...worst.map((d) => d.size))).toBeLessThan(Math.log(1.1));
    expect(Math.max(...worst.map((d) => d.shape))).toBeLessThan(Math.log(1.05));
    expect(Math.max(...worst.map((d) => d.color))).toBeLessThan(3);
    expect(oddOnesOut(found.features)?.odd.size).toBe(0);
  });
  it("crops original pixels rather than the 1200px working image", async () => {
    const full = await sharp(await scene(9)).resize(3600, 3000).png().toBuffer();
    const found = await segmentBottle(full);
    expect(found.image).toEqual({ width: 3600, height: 3000 });
    const crop = await sharp(found.crops[0]).metadata();
    expect(crop.width).toBeGreaterThan(250);
    expect(crop.width).toBe(Math.round(found.boxes[0].width * 3600));
  });
  it("honors EXIF orientation before mapping normalized boxes", async () => {
    const input = await sharp(await scene(3)).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const found = await segmentBottle(input);
    expect(found.image).toEqual({ width: 1000, height: 1200 });
    expect(found.boxes).toHaveLength(3);
  });
  it("rejects invalid bytes, byte excess, and decoded pixel excess", async () => {
    await expect(segmentBottle(Buffer.from("not a picture"))).rejects.toMatchObject({ code: "image" });
    await expect(segmentBottle(Buffer.alloc(MAX_BOTTLE_BYTES + 1))).rejects.toMatchObject({ code: "bytes" });
    const huge = await sharp({ create: { width: 6000, height: 6000, channels: 3, background: "white" } }).jpeg({ quality: 1 }).toBuffer();
    await expect(segmentBottle(huge)).rejects.toBeInstanceOf(Error);
  });
});

it("circles a visible thin cutoff instead of silently dropping it", async () => {
  const found = await segmentBottle(await layout([...grid().slice(0, 4), { cx: -30, cy: 820 }]));
  expect(found.boxes).toHaveLength(4);
  expect(found.clumps.some(c => c.kind === "cutoff")).toBe(true);
});

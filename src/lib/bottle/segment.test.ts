import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MAX_BOTTLE_BYTES, segmentBottle } from "./segment";
import { scene } from "./test-scenes";

describe("deterministic whole-bottle segmentation", () => {
  it.each(["white", "black", "#f6df89"])("finds every colored pill on %s", async (background) => {
    const found = await segmentBottle(await scene(9, { background, mixed: true }));
    expect(found.boxes).toHaveLength(9);
    expect(found.crops).toHaveLength(9);
    for (const b of found.boxes) { expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(1); expect(b.y + b.height).toBeLessThanOrEqual(1); }
  });
  it("tolerates low-amplitude wood-like texture", async () => {
    const input = await scene(6, { background: "#bc995f" });
    const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
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
  it.each([2, 9])("rejects a touching pair among %i pills without splitting", async (n) => {
    await expect(segmentBottle(await scene(n, { touching: true }))).rejects.toMatchObject({ code: "touching_clutter" });
  });
  it("rejects no pills and 25 pills, and accepts exactly 20", async () => {
    await expect(segmentBottle(await scene(0))).rejects.toMatchObject({ code: "none" });
    await expect(segmentBottle(await scene(25))).rejects.toMatchObject({ code: "too_many" });
    expect((await segmentBottle(await scene(20))).boxes).toHaveLength(20);
  });
  it("rejects a varied border, cut-off objects, and huge clutter", async () => {
    const varied = await sharp(Buffer.from('<svg width="1200" height="1000"><rect width="600" height="1000" fill="white"/><rect x="600" width="600" height="1000" fill="black"/></svg>')).png().toBuffer();
    await expect(segmentBottle(varied)).rejects.toMatchObject({ code: "background" });
    const edge = await sharp(Buffer.from('<svg width="1200" height="1000"><rect width="1200" height="1000" fill="white"/><ellipse cx="2" cy="500" rx="60" ry="40" fill="blue"/></svg>')).png().toBuffer();
    await expect(segmentBottle(edge)).rejects.toBeInstanceOf(Error);
    const clutter = await sharp(Buffer.from('<svg width="1200" height="1000"><rect width="1200" height="1000" fill="white"/><rect x="100" y="100" width="900" height="700" fill="blue"/></svg>')).png().toBuffer();
    await expect(segmentBottle(clutter)).rejects.toMatchObject({ code: "touching_clutter" });
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

import sharp from "sharp";
import type { NormalizedBox } from "./types";

export const MAX_BOTTLE_PILLS = 20;
export const MAX_BOTTLE_BYTES = 12 * 1024 * 1024;
export const MAX_BOTTLE_PIXELS = 32_000_000;
export const RETAKE_TIPS = "Use a plain surface in a different color from the pills. Spread them apart, keep every pill inside the frame, and photograph at most 20 at a time.";
export class SegmentationError extends Error {
  constructor(public code: string, message: string) { super(`${message} ${RETAKE_TIPS}`); this.name = "SegmentationError"; }
}
export type SegmentedBottle = {
  image: { width: number; height: number };
  boxes: NormalizedBox[];
  /** Request-local only. Never serialize or store this object. */
  crops: Buffer[];
  /** Development composite builder only; never requested by the API. */
  cutouts?: Buffer[];
};
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
const quantile = (a: number[], q: number) => [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * q)] ?? 0;

// CIE Lab (D65): Euclidean color distance is much less brightness-dependent than RGB.
function lab(r: number, g: number, b: number) {
  const linear = (v: number) => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  r = linear(r); g = linear(g); b = linear(b);
  const f = (v: number) => v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116;
  const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
  const y = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
  const z = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
function otsu(hist: Uint32Array, count: number) {
  let sum = 0; for (let i = 0; i < hist.length; i++) sum += i * hist[i];
  let n = 0, partial = 0, best = -1, threshold = 0;
  for (let i = 0; i < hist.length; i++) {
    n += hist[i]; partial += i * hist[i];
    if (!n || n === count) continue;
    const variance = n * (count - n) * (partial / n - (sum - partial) / (count - n)) ** 2;
    if (variance > best) { best = variance; threshold = i; }
  }
  return threshold;
}
function morph(src: Uint8Array, w: number, h: number, dilate: boolean) {
  const out = new Uint8Array(src.length);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    let v = dilate ? 0 : 1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dilate) v |= src[(y + dy) * w + x + dx]; else v &= src[(y + dy) * w + x + dx];
    }
    out[y * w + x] = v;
  }
  return out;
}
type Point = [number, number];
function hullArea(points: Point[]) {
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a: Point, b: Point, c: Point) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const half = (ps: Point[]) => { const out: Point[] = []; for (const p of ps) { while (out.length > 1 && cross(out.at(-2)!, out.at(-1)!, p) <= 0) out.pop(); out.push(p); } return out; };
  const top = half(points), bottom = half([...points].reverse()); top.pop(); bottom.pop();
  const hull = [...top, ...bottom];
  return Math.abs(hull.reduce((s, p, i) => { const q = hull[(i + 1) % hull.length]; return s + p[0] * q[1] - p[1] * q[0]; }, 0)) / 2;
}
function fillHoles(mask: Uint8Array, w: number, h: number) {
  const seen = new Uint8Array(mask.length), queue = new Int32Array(mask.length); let head = 0, tail = 0;
  const add = (i: number) => { if (!mask[i] && !seen[i]) { seen[i] = 1; queue[tail++] = i; } };
  for (let x = 0; x < w; x++) { add(x); add((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { add(y * w); add(y * w + w - 1); }
  while (head < tail) { const i = queue[head++], x = i % w; if (x) add(i - 1); if (x < w - 1) add(i + 1); if (i >= w) add(i - w); if (i < mask.length - w) add(i + w); }
  for (let i = 0; i < mask.length; i++) if (!seen[i]) mask[i] = 1;
}
/** A waist between two wider lobes is ambiguous. Detect only; never split it. */
function hasNeck(pixels: Int32Array, count: number, w: number) {
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let j = 0; j < count; j++) { const x = pixels[j] % w, y = Math.floor(pixels[j] / w); sx += x; sy += y; sxx += x*x; syy += y*y; sxy += x*y; }
  const angle = Math.atan2(2 * (sxy - sx*sy/count), (sxx - sx*sx/count) - (syy - sy*sy/count)) / 2;
  const cos = Math.cos(angle), sin = Math.sin(angle), bins = new Map<number, number>();
  for (let j = 0; j < count; j++) { const v = Math.round((pixels[j] % w) * cos + Math.floor(pixels[j] / w) * sin); bins.set(v, (bins.get(v) ?? 0) + 1); }
  const low = Math.min(...bins.keys()), high = Math.max(...bins.keys());
  const profile = Array.from({ length: high-low+1 }, (_, i) => { let sum = 0; for (let k = -2; k <= 2; k++) sum += bins.get(low+i+k) ?? 0; return sum / 5; });
  const gap = Math.max(4, Math.round(profile.length * .08));
  for (let j = Math.ceil(profile.length * .2); j < profile.length * .8; j++) {
    const left = Math.max(...profile.slice(0, Math.max(1, j-gap))), right = Math.max(...profile.slice(j+gap));
    if (profile[j] < Math.min(left, right) * .86) return true;
  }
  return false;
}
/** Deterministic foreground finding only. No drug recognition, no splitting ambiguous blobs. */
export async function segmentBottle(input: Buffer, options: { cutouts?: boolean; diagnostics?: (value: unknown) => void } = {}): Promise<SegmentedBottle> {
  if (!input.length || input.length > MAX_BOTTLE_BYTES) throw new SegmentationError("bytes", "Choose a photograph under 12 MB.");
  const source = sharp(input, { limitInputPixels: MAX_BOTTLE_PIXELS, failOn: "warning" });
  let metadata;
  try { metadata = await source.metadata(); } catch { throw new SegmentationError("image", "We couldn't open that photograph (maximum 32 megapixels)."); }
  if ((metadata.pages ?? 1) > 1) throw new SegmentationError("animation", "Choose a still photograph.");
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_BOTTLE_PIXELS) throw new SegmentationError("pixels", "Choose a photograph under 32 megapixels.");
  // Normalize orientation once, keeping original pixel resolution for all extracts.
  const original = await source.rotate().removeAlpha().toColourspace("srgb").png().toBuffer({ resolveWithObject: true });
  const image = { width: original.info.width, height: original.info.height };
  const { data, info } = await sharp(original.data).resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, n = w * h;
  if (w < 100 || h < 100) throw new SegmentationError("small", "Move closer and use a larger photograph.");
  const labs = new Float32Array(n * 3), border: number[][] = [[], [], []];
  const edge = Math.max(2, Math.round(Math.min(w, h) * 0.025));
  const borderIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = lab(data[i * info.channels], data[i * info.channels + 1], data[i * info.channels + 2]);
    labs.set(c, i * 3);
    const x = i % w, y = Math.floor(i / w);
    if ((x < edge || x >= w - edge || y < edge || y >= h - edge) && i % 3 === 0) { c.forEach((v, j) => border[j].push(v)); borderIndices.push(i); }
  }
  const bg = border.map(median), distances = new Float32Array(n), hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) { const d = Math.hypot(labs[3 * i] - bg[0], labs[3 * i + 1] - bg[1], labs[3 * i + 2] - bg[2]); distances[i] = d; hist[Math.min(255, Math.round(d))]++; }
  if (quantile(borderIndices.map((i) => distances[i]), 0.9) > 13) throw new SegmentationError("background", "The background varies too much to find every pill safely.");
  const threshold = Math.max(12, otsu(hist, n) + 0.5);
  let mask = Uint8Array.from(distances, (d) => d > threshold ? 1 : 0);
  mask = morph(morph(mask, w, h, false), w, h, true); // opening removes tiny specks
  mask = morph(morph(mask, w, h, true), w, h, false); // closing joins imprint holes
  fillHoles(mask, w, h);
  const seen = new Uint8Array(n), queue = new Int32Array(n);
  const components: { x: number; y: number; width: number; height: number; area: number; solidity: number; neck: boolean; edge: boolean }[] = [];
  const minArea = Math.max(24, n * 0.00008);
  for (let seed = 0; seed < n; seed++) {
    if (!mask[seed] || seen[seed]) continue;
    let head = 0, tail = 1, minX = w, maxX = 0, minY = h, maxY = 0;
    queue[0] = seed; seen[seed] = 1;
    const rows = new Map<number, [number, number]>();
    while (head < tail) {
      const i = queue[head++], x = i % w, y = Math.floor(i / w);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      const row = rows.get(y); rows.set(y, row ? [Math.min(row[0], x), Math.max(row[1], x)] : [x, x]);
      for (const j of [x ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (j >= 0 && j < n && mask[j] && !seen[j]) { seen[j] = 1; queue[tail++] = j; }
    }
    if (tail < minArea) continue;
    const hull = hullArea([...rows].flatMap(([y, [a, b]]) => [[a, y], [b, y]] as Point[]));
    components.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, area: tail, solidity: tail / Math.max(1, hull), neck: hasNeck(queue, tail, w), edge: minX <= edge || minY <= edge || maxX >= w - edge || maxY >= h - edge });
  }
  const typical = median(components.map((c) => c.area));
  const pills = components.filter((c) => c.area >= typical * 0.04);
  options.diagnostics?.({ threshold, typical, pills });
  if (!pills.length) throw new SegmentationError("none", "We couldn't find any separate pills.");
  if (pills.length > MAX_BOTTLE_PILLS) throw new SegmentationError("too_many", `We found ${pills.length} objects, more than the 20-pill limit.`);
  if (pills.some((c) => c.edge || c.neck || c.area > typical * 2.2 || c.area > n * 0.18 || Math.max(c.width / c.height, c.height / c.width) > 4.3 || c.solidity < 0.91 || c.area / (c.width * c.height) < 0.36)) throw new SegmentationError("touching_clutter", "Some pills may be touching, cut off, or mixed with other objects.");
  // Stable row-major numbering. No shape/color assumptions influence which blobs are kept.
  pills.sort((a, b) => Math.abs(a.y - b.y) < Math.min(a.height, b.height) * 0.5 ? a.x - b.x : a.y - b.y);
  const boxes: NormalizedBox[] = [], crops: Buffer[] = [], cutouts: Buffer[] = [];
  const alpha = options.cutouts ? await sharp(Buffer.from(mask.map((v) => v * 255)), { raw: { width: w, height: h, channels: 1 } }).resize(image.width, image.height, { kernel: "nearest" }).png().toBuffer() : null;
  for (const p of pills) {
    const pad = Math.max(4, Math.round(Math.max(p.width, p.height) * 0.08));
    const left = Math.max(0, Math.floor((p.x - pad) * image.width / w));
    const top = Math.max(0, Math.floor((p.y - pad) * image.height / h));
    const right = Math.min(image.width, Math.ceil((p.x + p.width + pad) * image.width / w));
    const bottom = Math.min(image.height, Math.ceil((p.y + p.height + pad) * image.height / h));
    const region = { left, top, width: right - left, height: bottom - top };
    boxes.push({ x: left / image.width, y: top / image.height, width: region.width / image.width, height: region.height / image.height });
    crops.push(await sharp(original.data).extract(region).png().toBuffer());
    if (alpha) {
      const cropAlpha = await sharp(alpha).extract(region).greyscale().raw().toBuffer();
      cutouts.push(await sharp(original.data).extract(region).joinChannel(cropAlpha, { raw: { width: region.width, height: region.height, channels: 1 } }).png().toBuffer());
    }
  }
  return { image, boxes, crops, ...(options.cutouts ? { cutouts } : {}) };
}

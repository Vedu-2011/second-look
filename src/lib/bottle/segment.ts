import { splitTouching, SPLIT_RULES } from "./split-touching";
import sharp from "sharp";
import type { BottleClump, NormalizedBox, PillFeatures } from "./types";

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
  /** Measured from each pill's silhouette in the photo (no AI); same order as boxes. */
  features: PillFeatures[];
  /** Touching pills and pills cut off at the edge: circled, never read, never green. */
  clumps: BottleClump[];
  /** Request-local only. Never serialize or store this object. */
  crops: Buffer[];
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
/**
 * Background color, estimated locally. Real counters and towels have folds, shading and a strip of table at one
 * edge, so one global background color fails. Pass 1 takes a wide median of coarse cells (pills are a minority of
 * any window when spread out); pass 2 re-averages each cell from pixels pass 1 called background.
 */
function localBackground(labs: Float32Array, w: number, h: number, threshold: (d: Float32Array) => number) {
  const cell = Math.max(8, Math.round(Math.min(w, h) / 48)), gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
  const grid = (values: (gx: number, gy: number) => number[] | null) => {
    const out = new Float32Array(gw * gh * 3), known = new Uint8Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) { const v = values(gx, gy); if (v) { out.set(v, (gy * gw + gx) * 3); known[gy * gw + gx] = 1; } }
    return { out, known };
  };
  const sample = (from: Float32Array, x: number, y: number) => {
    // Bilinear between cell centers, so the model has no block edges.
    const fx = Math.min(gw - 1, Math.max(0, (x + 0.5) / cell - 0.5)), fy = Math.min(gh - 1, Math.max(0, (y + 0.5) / cell - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
    return [0, 1, 2].map((c) => (from[(y0 * gw + x0) * 3 + c] * (1 - tx) + from[(y0 * gw + x1) * 3 + c] * tx) * (1 - ty) + (from[(y1 * gw + x0) * 3 + c] * (1 - tx) + from[(y1 * gw + x1) * 3 + c] * tx) * ty);
  };
  const distances = (model: Float32Array) => {
    const d = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, b = sample(model, x, y); d[i] = Math.hypot(labs[3 * i] - b[0], labs[3 * i + 1] - b[1], labs[3 * i + 2] - b[2]); }
    return d;
  };
  // Pass 1: per-cell medians, then a median over a window about a quarter of the photo wide.
  const cells = grid((gx, gy) => {
    const ch: number[][] = [[], [], []];
    for (let y = gy * cell; y < Math.min(h, (gy + 1) * cell); y += 2) for (let x = gx * cell; x < Math.min(w, (gx + 1) * cell); x += 2) for (let c = 0; c < 3; c++) ch[c].push(labs[(y * w + x) * 3 + c]);
    return ch.map(median);
  }).out;
  const radius = Math.max(2, Math.round(Math.min(gw, gh) * 0.13));
  const first = grid((gx, gy) => {
    const ch: number[][] = [[], [], []];
    for (let y = Math.max(0, gy - radius); y <= Math.min(gh - 1, gy + radius); y++) for (let x = Math.max(0, gx - radius); x <= Math.min(gw - 1, gx + radius); x++) for (let c = 0; c < 3; c++) ch[c].push(cells[(y * gw + x) * 3 + c]);
    return ch.map(median);
  }).out;
  const d1 = distances(first), t1 = threshold(d1);
  // Pass 2: average only pixels pass 1 called background (with a margin), fill gaps from neighbors, smooth.
  const second = grid((gx, gy) => {
    const sum = [0, 0, 0]; let count = 0, total = 0;
    for (let y = gy * cell; y < Math.min(h, (gy + 1) * cell); y++) for (let x = gx * cell; x < Math.min(w, (gx + 1) * cell); x++) {
      total++; const i = y * w + x; if (d1[i] > t1 * 0.6) continue;
      count++; for (let c = 0; c < 3; c++) sum[c] += labs[3 * i + c];
    }
    return count >= total * 0.3 ? sum.map((v) => v / count) : null;
  });
  for (let pass = 0; pass < gw + gh && second.known.includes(0); pass++) {
    const known = second.known.slice();
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      const i = gy * gw + gx; if (known[i]) continue;
      const sum = [0, 0, 0]; let n = 0;
      for (const [x, y] of [[gx - 1, gy], [gx + 1, gy], [gx, gy - 1], [gx, gy + 1]]) if (x >= 0 && y >= 0 && x < gw && y < gh && known[y * gw + x]) { n++; for (let c = 0; c < 3; c++) sum[c] += second.out[(y * gw + x) * 3 + c]; }
      if (n) { second.out.set(sum.map((v) => v / n), i * 3); second.known[i] = 1; }
    }
  }
  if (second.known.includes(0)) return d1; // no background anywhere: keep pass 1
  const smooth = grid((gx, gy) => {
    const sum = [0, 0, 0]; let n = 0;
    for (let y = Math.max(0, gy - 1); y <= Math.min(gh - 1, gy + 1); y++) for (let x = Math.max(0, gx - 1); x <= Math.min(gw - 1, gx + 1); x++) { n++; for (let c = 0; c < 3; c++) sum[c] += second.out[(y * gw + x) * 3 + c]; }
    return sum.map((v) => v / n);
  }).out;
  return distances(smooth);
}
/** Size, shape and color of one silhouette, from its pixels only (no AI). Lengths are in working-image pixels. */
function measure(pixels: Int32Array, w: number, labs: Float32Array, n: number): Omit<PillFeatures, "relativeArea"> {
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let j = 0; j < pixels.length; j++) { const x = pixels[j] % w, y = Math.floor(pixels[j] / w); sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
  const c = pixels.length, mx = sx / c, my = sy / c, vxx = sxx / c - mx * mx, vyy = syy / c - my * my, vxy = sxy / c - mx * my;
  const spread = Math.sqrt(((vxx - vyy) / 2) ** 2 + vxy ** 2), major = (vxx + vyy) / 2 + spread, minor = Math.max(0.25, (vxx + vyy) / 2 - spread);
  const angle = Math.atan2(2 * vxy, vxx - vyy) / 2, cos = Math.cos(angle), sin = Math.sin(angle);
  // Color from the middle of the pill only, away from shadows and edge blending.
  const ch: number[][] = [[], [], []];
  for (let j = 0; j < pixels.length; j++) {
    const dx = pixels[j] % w - mx, dy = Math.floor(pixels[j] / w) - my, u = dx * cos + dy * sin, v = -dx * sin + dy * cos;
    if (u * u / (4 * major) + v * v / (4 * minor) < 0.45) for (let k = 0; k < 3; k++) ch[k].push(labs[pixels[j] * 3 + k]);
  }
  const length = 4 * Math.sqrt(major), width = 4 * Math.sqrt(minor);
  return { length, width, aspect: length / width, area: c / n, lab: ch.map((v) => Math.round(median(v) * 10) / 10) as [number, number, number] };
}
type Component = { x: number; y: number; width: number; height: number; area: number; solidity: number; neck: boolean; edge: boolean; pixels: Int32Array };
const toBox = (p: Component, w: number, h: number, image: { width: number; height: number }) => {
  const pad = Math.max(4, Math.round(Math.max(p.width, p.height) * 0.08));
  const left = Math.max(0, Math.floor((p.x - pad) * image.width / w)), top = Math.max(0, Math.floor((p.y - pad) * image.height / h));
  const right = Math.min(image.width, Math.ceil((p.x + p.width + pad) * image.width / w)), bottom = Math.min(image.height, Math.ceil((p.y + p.height + pad) * image.height / h));
  return { region: { left, top, width: right - left, height: bottom - top }, box: { x: left / image.width, y: top / image.height, width: (right - left) / image.width, height: (bottom - top) / image.height } };
};
const rowMajor = <T extends { y: number; x: number; height: number }>(a: T, b: T) => Math.abs(a.y - b.y) < Math.min(a.height, b.height) * 0.5 ? a.x - b.x : a.y - b.y;

/** Deterministic foreground finding only. No drug recognition, no splitting ambiguous blobs. */
export async function segmentBottle(input: Buffer, options: { diagnostics?: (value: unknown) => void } = {}): Promise<SegmentedBottle> {
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
  const labs = new Float32Array(n * 3);
  const edge = Math.max(2, Math.round(Math.min(w, h) * 0.025));
  const borderIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    labs.set(lab(data[i * info.channels], data[i * info.channels + 1], data[i * info.channels + 2]), i * 3);
    const x = i % w, y = Math.floor(i / w);
    if ((x < edge || x >= w - edge || y < edge || y >= h - edge) && i % 3 === 0) borderIndices.push(i);
  }
  const otsuThreshold = (d: Float32Array) => { const hist = new Uint32Array(256); for (const v of d) hist[Math.min(255, Math.round(v))]++; return Math.max(12, otsu(hist, d.length) + 0.5); };
  const distances = localBackground(labs, w, h, otsuThreshold);
  const threshold = otsuThreshold(distances);
  // Fixed synthetic dark-paper/noise controls: low-light teal chroma can be visible without a large L contrast.
  const saturation = (i: number) => { const r=data[i*info.channels],g=data[i*info.channels+1],b=data[i*info.channels+2];return (Math.max(r,g,b)-Math.min(r,g,b))/Math.max(1,Math.max(r,g,b)); };
  const teal = (i: number) => Math.max(data[i*info.channels+1],data[i*info.channels+2])-data[i*info.channels];
  const chroma = (i: number) => Math.hypot(labs[i*3+1],labs[i*3+2]);
  const bgSat=median(borderIndices.map(saturation)),bgTeal=median(borderIndices.map(teal)),bgChroma=median(borderIndices.map(chroma));
  let mask = Uint8Array.from(distances, (d,i) => d > threshold || (labs[i*3]<65 && saturation(i)>bgSat+.12 && teal(i)>bgTeal+6 && chroma(i)>bgChroma+4) ? 1 : 0);
  mask = morph(morph(mask, w, h, false), w, h, true); // opening removes tiny specks
  mask = morph(morph(mask, w, h, true), w, h, false); // closing joins imprint holes
  fillHoles(mask, w, h);
  const seen = new Uint8Array(n), queue = new Int32Array(n);
  const components: Component[] = [];
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
    components.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, area: tail, solidity: tail / Math.max(1, hull), neck: hasNeck(queue, tail, w), edge: minX <= edge || minY <= edge || maxX >= w - edge || maxY >= h - edge, pixels: queue.slice(0, tail) });
  }
  // Another surface along a side of the photo (the table past the towel, a plate rim) runs along that side.
  // It is background, not a pill; but if such surfaces cover much of the photo, the background is too busy.
  const surfaces = components.filter((c) => c.edge && c.area > n * 0.01 && (c.width >= w * 0.4 || c.height >= h * 0.4));
  if (surfaces.reduce((sum, c) => sum + c.area, 0) > n * 0.35) throw new SegmentationError("background", "The background varies too much to find every pill safely.");
  const onSurface = new Uint8Array(n); for (const c of surfaces) for (const i of c.pixels) onSurface[i] = 1;
  // After removing slow shading, the rest of the border must be plain: a busy pattern could hide or invent pills.
  if (quantile(borderIndices.filter((i) => !onSurface[i]).map((i) => distances[i]), 0.9) > 13) throw new SegmentationError("background", "The background varies too much to find every pill safely.");
  // "Typical" comes from objects fully inside the frame, so a long table edge can't skew it.
  const typical = median(components.filter((c) => !c.edge).map((c) => c.area)) || median(components.filter((c) => !surfaces.includes(c)).map((c) => c.area));
  const objects = components.filter((c) => !surfaces.includes(c) && c.area >= typical * 0.04);
  if (objects.some((c) => c.area > n * 0.18)) throw new SegmentationError("touching_clutter", "Something large is in the photo with the pills.");
  const thin = (c: Component) => Math.max(c.width / c.height, c.height / c.width) > 4.3 || c.area / (c.width * c.height) < 0.36;
  // Every detected edge foreground remains unchecked, even if it resembles a surface or a thin sliver.
  const cutoffs = components.filter((c) => c.edge);
  const inside = objects.filter((c) => !c.edge);
  const candidates = inside.filter((c) => c.neck || c.area > typical * 2.2 || c.solidity < 0.91 || thin(c));
  const touching: Component[] = [], split: Component[] = [];
  for (const c of candidates) {
    const parts = splitTouching(c.pixels, w);
    const measured = parts?.map(pixels => {
      let x=w,y=h,right=0,bottom=0;const rows=new Map<number,[number,number]>();
      for(const i of pixels){const px=i%w,py=Math.floor(i/w);x=Math.min(x,px);y=Math.min(y,py);right=Math.max(right,px);bottom=Math.max(bottom,py);const r=rows.get(py);rows.set(py,r?[Math.min(r[0],px),Math.max(r[1],px)]:[px,px]);}
      const hull=hullArea([...rows].flatMap(([py,[a,b]])=>[[a,py],[b,py]] as Point[]));
      return { x,y,width:right-x+1,height:bottom-y+1,area:pixels.length,solidity:pixels.length/Math.max(1,hull),neck:hasNeck(pixels,pixels.length,w),edge:false,pixels };
    });
    if(measured?.length===2 && measured.every(p=>p.area>=minArea && p.solidity>=SPLIT_RULES.minSolidity && !p.neck && !thin(p) && measure(p.pixels,w,labs,n).aspect<=SPLIT_RULES.maxAspect))split.push(...measured);
    else touching.push(c);
  }
  const pills = [...inside.filter((c) => !candidates.includes(c)), ...split];
  options.diagnostics?.({ threshold, typical, pills, touching, cutoffs, surfaces: surfaces.length, ignoredAtEdge: objects.filter((c) => c.edge && !cutoffs.includes(c)).length });
  if (!pills.length && !touching.length && !cutoffs.length) throw new SegmentationError("none", "We couldn't find any separate pills.");
  if (pills.length > MAX_BOTTLE_PILLS) throw new SegmentationError("too_many", `We found ${pills.length} objects, more than the 20-pill limit.`);
  // Stable row-major numbering. No shape/color assumptions influence which blobs are kept.
  pills.sort(rowMajor);
  const pillArea = median(pills.map((p) => p.area)) || typical;
  const boxes: NormalizedBox[] = [], crops: Buffer[] = [], features: PillFeatures[] = [];
  for (const p of pills) {
    const { region, box } = toBox(p, w, h, image);
    boxes.push(box);
    features.push({ ...measure(p.pixels, w, labs, n), relativeArea: p.area / pillArea });
    crops.push(await sharp(original.data).extract(region).png().toBuffer());
  }
  const clumps: BottleClump[] = [...touching.map((c) => ({ c, kind: "touching" as const })), ...cutoffs.map((c) => ({ c, kind: "cutoff" as const }))]
    .sort((a, b) => rowMajor(a.c, b.c)).map(({ c, kind }) => ({ kind, box: toBox(c, w, h, image).box }));
  return { image, boxes, features, clumps, crops };
}

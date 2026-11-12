import type { NormalizedBox, PillOutline } from "./types";

/** The exact same geometry is used over a live photograph and over a neutral shared canvas. */
export function boxCenter(box: NormalizedBox) {
  return { x: (box.x + box.width / 2) * 100, y: (box.y + box.height / 2) * 100 };
}
export function pixelCrop(box: NormalizedBox, width: number, height: number) {
  const left = Math.max(0, Math.floor(box.x * width)), top = Math.max(0, Math.floor(box.y * height));
  return { left, top, width: Math.min(width - left, Math.ceil((box.x + box.width) * width) - left), height: Math.min(height - top, Math.ceil((box.y + box.height) * height) - top) };
}

/** Live badges sit beside the pill; shared dots mark its actual center. */
export function markerPosition(box: NormalizedBox, photo: boolean) {
  const p = photo ? { x: (box.x + box.width) * 100, y: box.y * 100 } : boxCenter(box);
  const margin = photo ? 22 : 30;
  return { left: `clamp(${margin}px, ${p.x}%, calc(100% - ${margin}px))`, top: `clamp(${margin}px, ${p.y}%, calc(100% - ${margin}px))` };
}
/** The shared ring uses the exact dot anchor, including edge clamping. */
export function pillRingPosition(box: NormalizedBox, photo: boolean) {
  return photo ? { left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }
    : { ...markerPosition(box, false), width: '56px', height: '56px', transform: 'translate(-50%, -50%)' };
}

type Size = { width: number; height: number };
type Point = { x: number; y: number };
/** A pill as a capsule (stadium) in container pixels: center, long-axis angle, full length and width. */
export type MarkShape = { cx: number; cy: number; angle: number; length: number; width: number };
export type MarkInput = { box: NormalizedBox; outline?: PillOutline; draw: boolean; chip: boolean };
export type MarkLayout = { shape: MarkShape | null; chip: Point | null; dot: Point | null };
/** Space between the pill's edge and its ring. */
export const RING_PAD = 4;
const DOT = 10;

/** The pill's own silhouette when we measured it; otherwise the capsule that fills its box. */
export function pillShape(box: NormalizedBox, outline: PillOutline | undefined, size: Size): MarkShape {
  if (outline) return { cx: outline.cx * size.width, cy: outline.cy * size.height, angle: outline.angle, length: Math.max(outline.length, outline.width) * size.width, width: Math.min(outline.length, outline.width) * size.width };
  const w = box.width * size.width, h = box.height * size.height;
  return { cx: (box.x + box.width / 2) * size.width, cy: (box.y + box.height / 2) * size.height, angle: w >= h ? 0 : Math.PI / 2, length: Math.max(w, h), width: Math.min(w, h) };
}
/** Distance from a point to the pill's edge (negative inside the pill). */
export function capsuleDistance(p: Point, s: MarkShape) {
  const half = Math.max(0, (s.length - s.width) / 2), ux = Math.cos(s.angle), uy = Math.sin(s.angle), dx = p.x - s.cx, dy = p.y - s.cy;
  const t = Math.max(-half, Math.min(half, dx * ux + dy * uy));
  return Math.hypot(dx - t * ux, dy - t * uy) - s.width / 2;
}
/** Points on the ring around a pill (its capsule grown by `grow`), each with its outward direction. */
function ringPoints(s: MarkShape, grow: number, n = 36) {
  const half = Math.max(0, (s.length - s.width) / 2), r = s.width / 2 + grow, cos = Math.cos(s.angle), sin = Math.sin(s.angle);
  return Array.from({ length: n }, (_, k) => {
    const phi = (k + 0.5) / n * 2 * Math.PI, dx = Math.cos(phi), dy = Math.sin(phi);
    const lx = Math.sign(dx) * half + r * dx, ly = r * dy; // support point of the capsule in direction (dx, dy)
    return { x: s.cx + lx * cos - ly * sin, y: s.cy + lx * sin + ly * cos, nx: dx * cos - dy * sin, ny: dx * sin + dy * cos };
  });
}
/**
 * Marks drawn ON each pill: a ring that follows the pill, and a small number chip that TOUCHES that ring on the side
 * with the most open space. A chip is only placed where its own pill is clearly the nearest pill (and it covers no
 * other pill, no unread region and no other chip); otherwise it shrinks to a number-less dot on the ring, or is left
 * out (the number stays in the list below). `obstacles` are unread regions. Pixels in, pixels out.
 */
export function layoutMarks(inputs: readonly MarkInput[], size: Size, chip: number, obstacles: readonly NormalizedBox[] = []): MarkLayout[] {
  const all = inputs.map((m) => pillShape(m.box, m.outline, size));
  const blocks = obstacles.map((b) => pillShape(b, undefined, size));
  const placed: (Point & { r: number })[] = [];
  const place = (i: number, r: number) => {
    let best: Point | null = null, bestScore = -Infinity;
    for (const p of ringPoints(all[i], RING_PAD)) {
      const c = { x: p.x + p.nx * (r + 1), y: p.y + p.ny * (r + 1) };
      if (c.x < r || c.y < r || c.x > size.width - r || c.y > size.height - r) continue;
      if (placed.some((q) => Math.hypot(q.x - c.x, q.y - c.y) < q.r + r + 2)) continue;
      const own = capsuleDistance(c, all[i]);
      let clearance = Infinity;
      for (const [j, other] of all.entries()) if (j !== i) clearance = Math.min(clearance, capsuleDistance(c, other));
      for (const other of blocks) clearance = Math.min(clearance, capsuleDistance(c, other));
      if (clearance <= own + 2 || clearance <= r + 1) continue;
      // Most open space first; slight preference for above-right, where people look for a badge.
      const score = Math.min(clearance, 3 * r) + (p.nx - p.ny) * 0.5;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (best) placed.push({ ...best, r });
    return best;
  };
  return inputs.map((m, i) => {
    if (!m.draw) return { shape: null, chip: null, dot: null };
    if (!m.chip) return { shape: all[i], chip: null, dot: null };
    const c = place(i, chip / 2);
    return { shape: all[i], chip: c, dot: c ? null : place(i, DOT / 2) };
  });
}
/** Pile pills whose box we shouldn't draw on: guessed, far bigger than a pill, or mostly on top of another pill's box. */
export function undrawable(pills: readonly { box: NormalizedBox; fromPile?: boolean; boxGuessed?: boolean }[]) {
  const area = (b: NormalizedBox) => b.width * b.height;
  const separate = pills.filter((p) => !p.fromPile).map((p) => area(p.box)).sort((a, b) => a - b);
  const typical = separate[Math.floor(separate.length / 2)];
  const overlap = (a: NormalizedBox, b: NormalizedBox) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return pills.map((p, i) => Boolean(p.fromPile && (p.boxGuessed || (typical && area(p.box) > typical * 3)
    || pills.some((q, j) => j < i && overlap(p.box, q.box) > 0.6 * Math.min(area(p.box), area(q.box))))));
}

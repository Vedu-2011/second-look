import type { NormalizedBox } from "./types";

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
/**
 * Small number pins placed just OUTSIDE each pill and pushed apart: no pin overlaps another pin or covers a pill.
 * Works in container pixels (`size`), returns centers as fractions of the photo. Pins are `pin` px across.
 */
export function layoutPins(boxes: readonly NormalizedBox[], size: Size, pin: number) {
  const r = pin / 2, gap = 3;
  const rects = boxes.map(b => ({ x: b.x * size.width, y: b.y * size.height, w: b.width * size.width, h: b.height * size.height }));
  const placed: { x: number; y: number }[] = [];
  const clear = (x: number, y: number) =>
    x >= r && x <= size.width - r && y >= r && y <= size.height - r &&
    placed.every(p => Math.hypot(p.x - x, p.y - y) >= pin + 1) &&
    rects.every(b => x <= b.x - r || x >= b.x + b.w + r || y <= b.y - r || y >= b.y + b.h + r);
  // Up-right first (where a reader expects a badge), then around the pill; further rings if crowded.
  const angles = [-45, 0, -90, -135, 180, 45, 90, 135].map(a => a * Math.PI / 180);
  return rects.map(b => {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    let best: { x: number; y: number } | null = null;
    for (let ring = 0; ring < 6 && !best; ring++) for (const a of angles) {
      const cos = Math.cos(a), sin = Math.sin(a);
      const edge = Math.min(Math.abs(cos) > 1e-6 ? b.w / 2 / Math.abs(cos) : Infinity, Math.abs(sin) > 1e-6 ? b.h / 2 / Math.abs(sin) : Infinity);
      const d = edge + r * Math.SQRT2 + gap + ring * (pin * 0.75);
      const x = cx + cos * d, y = cy + sin * d;
      if (clear(x, y)) { best = { x, y }; break; }
    }
    // Nowhere free (a very crowded photo): fall back to the top-right corner, kept inside the photo.
    const p = best ?? { x: Math.min(size.width - r, Math.max(r, b.x + b.w + r)), y: Math.min(size.height - r, Math.max(r, b.y - r)) };
    placed.push(p);
    return { x: p.x / size.width, y: p.y / size.height };
  });
}

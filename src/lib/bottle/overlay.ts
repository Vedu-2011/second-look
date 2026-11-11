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

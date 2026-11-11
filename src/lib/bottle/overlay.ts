import type { NormalizedBox } from "./types";

/** The exact same geometry is used over a live photograph and over a neutral shared canvas. */
export function boxCenter(box: NormalizedBox) {
  return { x: (box.x + box.width / 2) * 100, y: (box.y + box.height / 2) * 100 };
}
export function pixelCrop(box: NormalizedBox, width: number, height: number) {
  const left = Math.max(0, Math.floor(box.x * width)), top = Math.max(0, Math.floor(box.y * height));
  return { left, top, width: Math.min(width - left, Math.ceil((box.x + box.width) * width) - left), height: Math.min(height - top, Math.ceil((box.y + box.height) * height) - top) };
}

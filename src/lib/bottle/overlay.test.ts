import { describe, expect, it } from "vitest";
import { boxCenter, pixelCrop } from "./overlay";

describe("shared/live overlay mapping", () => {
  it("uses fractional boxes independent of viewport and preserves image aspect", () => {
    const box = { x: .25, y: .1, width: .2, height: .3 };
    expect(boxCenter(box)).toEqual({ x: 35, y: 25 });
    expect(pixelCrop(box, 4000, 3000)).toEqual({ left: 1000, top: 300, width: 800, height: 900 });
    expect(pixelCrop(box, 400, 300)).toEqual({ left: 100, top: 30, width: 80, height: 90 });
  });
  it("clips padded crop edges to original pixels", () => {
    expect(pixelCrop({ x: .95, y: .9, width: .05, height: .1 }, 100, 100)).toEqual({ left: 95, top: 90, width: 5, height: 10 });
  });
});

it('centers a shared ring on its numbered dot, while a live ring encloses the photo crop', async () => {
  const { markerPosition, pillRingPosition } = await import('./overlay');
  const box = { x: .3, y: .4, width: .2, height: .1 };
  const dot = markerPosition(box, false), ring = pillRingPosition(box, false);
  expect(ring.left).toBe(dot.left); expect(ring.top).toBe(dot.top);
  expect(ring).toMatchObject({ transform: 'translate(-50%, -50%)' });
  expect(pillRingPosition(box, true)).toMatchObject({ left: '30%', top: '40%', width: '20%', height: '10%' });
});

import { expect, it } from "vitest";
import { mapFive } from "./check-bottle";
it("preserves crop order with no more than five active workers", async () => {
  let active = 0, peak = 0;
  const out = await mapFive(Array.from({ length: 20 }, (_, i) => i), async (i) => { active++; peak = Math.max(active, peak); await new Promise((r) => setTimeout(r, (i % 3) + 1)); active--; return i * 2; });
  expect(peak).toBe(5); expect(out).toEqual(Array.from({ length: 20 }, (_, i) => i * 2));
});

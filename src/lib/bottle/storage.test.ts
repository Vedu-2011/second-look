import { expect, it, vi } from "vitest";
import { SAMPLE_RESULTS } from "@/lib/sample-results";
import { decideBottle } from "./decide-bottle";
import type { BottleResult } from "./types";
vi.mock("@/lib/redis", () => ({ getRedis: () => null, key: (s: string) => "sl:" + s }));
const { getBottleResult, getResult, saveBottleResult } = await import("@/lib/result-store");
it("shares normalized boxes and readings, never live photograph or crop payloads", async () => {
  const pill = { number: 1, carried: true, previousVerdict: "MATCH" as const, box: { x: .1, y: .1, width: .2, height: .3 }, result: structuredClone(SAMPLE_RESULTS[0].result) };
  Object.assign(pill, { crop: "data:image/png;base64,private" }); Object.assign(pill.result, { dataUrl: "private" }); Object.assign(pill.result.pill, { image: "private" }); Object.assign(pill.result.label, { photo: "private" });
  const result: BottleResult = { kind: "bottle", label: pill.result.label, pills: [pill], decision: decideBottle([pill]), image: { width: 4000, height: 3000 }, usage: [], checkedAt: new Date().toISOString(), elapsedMs: 10 };
  Object.assign(result, { photo: "private", crops: [Buffer.from("private")] });
  const id = await saveBottleResult(result), shared = await getBottleResult(id);
  expect(shared?.result.pills[0].previousVerdict).toBe("MATCH");
  expect(shared?.result.pills[0].box).toEqual(pill.box); expect(shared?.result.image).toEqual({ width: 4000, height: 3000 });
  expect(JSON.stringify(shared)).not.toContain("private"); expect(await getResult(id)).toBeNull();
});

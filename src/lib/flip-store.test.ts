import { afterEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_RESULTS } from "./sample-results";
vi.mock("./redis", () => ({
  getRedis: () => null,
  key: (name: string) => "sl:" + name,
}));
import { getFlip, saveFlip } from "./flip-store";
afterEach(() => vi.useRealTimers());
describe("short-lived, server-owned readings", () => {
  it("stores a reading under a random ID without images", async () => {
    const result = SAMPLE_RESULTS[0].result;
    const id = await saveFlip(result);
    expect(id).toMatch(/^[a-f0-9-]{36}$/);
    expect(await getFlip(id)).toEqual(result);
  });
  it("expires rather than trusting stale client readings", async () => {
    vi.useFakeTimers();
    const id = await saveFlip(SAMPLE_RESULTS[0].result);
    vi.advanceTimersByTime(600001);
    expect(await getFlip(id)).toBeNull();
  });
});

import { expect, it, vi } from "vitest";
const { evalMock } = vi.hoisted(() => ({ evalMock: vi.fn() }));
vi.mock("@/lib/redis", () => ({ key: (s: string) => `sl:${s}`, getRedis: () => ({ eval: evalMock }) }));
const { consumeCheckLimit } = await import("@/lib/rate-limit");
it("uses one shared atomic Redis script for both weighted counters", async () => {
  evalMock.mockResolvedValueOnce([1,4,0]); expect(await consumeCheckLimit("atomic",4)).toEqual({ allowed: true, count: 4 });
  const [script, keys, args] = evalMock.mock.calls.at(-1)!;
  expect(script).toContain("INCRBY"); expect(script).toContain("h+n > 30"); expect(keys[0]).toContain("sl:rate:atomic:"); expect(keys[1]).toContain("sl:daily:"); expect(args[0]).toBe(4);
});
it("fails closed on a shared-counter outage instead of bypassing global caps", async () => {
  evalMock.mockRejectedValueOnce(new Error("Redis unavailable")); const result = await consumeCheckLimit("outage",4); expect(result.allowed).toBe(false);
});

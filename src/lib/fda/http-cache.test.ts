import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis", async (orig) => ({ ...(await orig<typeof import("@/lib/redis")>()), getRedis: () => null }));

const { cached, cacheStats, clearMemoryCache, fdaCacheKey } = await import("./cache");
const { FdaError, fetchJson, friendlyFdaMessage } = await import("./http");

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("fetchJson", () => {
  it("retries once on a server error, then succeeds", async () => {
    const f = vi.fn().mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json({ ok: 1 }));
    await expect(fetchJson("https://x.test", { fetchImpl: f })).resolves.toEqual({ ok: 1 });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("turns timeouts into a friendly error after one retry", async () => {
    const f = vi.fn().mockRejectedValue(Object.assign(new Error("slow"), { name: "TimeoutError" }));
    const err = (await fetchJson("https://x.test", { fetchImpl: f }).catch((e) => e)) as InstanceType<typeof FdaError>;
    expect(f).toHaveBeenCalledTimes(2);
    expect(err).toBeInstanceOf(FdaError);
    expect(err.code).toBe("timeout");
    expect(friendlyFdaMessage(err)).toMatch(/took too long/);
  });

  it("doesn't retry a 404 and flags bad JSON", async () => {
    const f = vi.fn().mockResolvedValue(json({}, 404));
    await expect(fetchJson("https://x.test", { fetchImpl: f })).rejects.toMatchObject({ code: "bad_response" });
    expect(f).toHaveBeenCalledTimes(1);
    const g = vi.fn().mockResolvedValue(new Response("<html>", { status: 200 }));
    await expect(fetchJson("https://x.test", { fetchImpl: g })).rejects.toMatchObject({ code: "bad_response" });
  });

  it("never shows a raw error to people", () => {
    expect(friendlyFdaMessage(new Error("ECONNRESET at socket"))).not.toMatch(/ECONNRESET/);
  });
});

describe("cached", () => {
  beforeEach(() => clearMemoryCache());

  it("loads once, then answers from memory", async () => {
    const load = vi.fn().mockResolvedValue([1, 2]);
    await cached("https://x.test/a", load);
    await expect(cached("https://x.test/a", load)).resolves.toEqual([1, 2]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(cacheStats).toMatchObject({ misses: 1, memoryHits: 1 });
  });

  it("keys every FDA entry under the sl: prefix", () => {
    expect(fdaCacheKey("https://rxnav.nlm.nih.gov/x")).toBe("sl:fda:https://rxnav.nlm.nih.gov/x");
  });

  it("doesn't cache failures", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce("ok");
    await expect(cached("https://x.test/b", load)).rejects.toThrow("down");
    await expect(cached("https://x.test/b", load)).resolves.toBe("ok");
  });
});

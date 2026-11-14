// Phase 11g units: what the browser does with each failure, the per-request read cache, and remembered quota.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { classifyFailure, OURS_MESSAGE } from "@/lib/bottle/retry";
import { clearReadCacheForTests, requestReadCache } from "@/lib/ai/read-cache";
import { clearPaidForTests, clearRateLimitForTests, consumeCheckLimit, hourlyUsedForTests, joinCheck } from "@/lib/rate-limit";

vi.mock("@/lib/redis", () => ({ getRedis: () => null, key: (v: string) => "sl:" + v }));
beforeEach(() => { clearReadCacheForTests(); clearPaidForTests(); clearRateLimitForTests(); });

describe("only a photo problem sends you back to the camera", () => {
  it.each([
    ["the upload never reached us (iOS 'Load failed')", { why: "network" } as const],
    ["the check ran past our limit", { why: "timeout" } as const],
    ["the stream was cut short", { why: "ended-early" } as const],
    ["a garbled stream", { why: "bad-stream" } as const],
    ["a 504 from the platform", { why: "http", status: 504 } as const],
    ["a 500", { why: "http", status: 500 } as const],
    ["a retryable server error", { why: "event", event: { type: "error", message: "FDA timed out", retryable: true } } as const],
  ])("%s → ours: keep the photos, retry", (_name, input) => {
    expect(classifyFailure(input)).toMatchObject({ kind: "ours", message: OURS_MESSAGE });
  });
  it.each([
    ["the segmenter's retake", { why: "event", event: { type: "retake", code: "too_many", message: "We found 25 objects" } } as const, "photo"],
    ["a photo the server can't open", { why: "http", status: 400, error: "We couldn't open those photos." } as const, "photo"],
    ["photos too large together", { why: "too-large", message: "Too large" } as const, "photo"],
    ["the hourly limit", { why: "http", status: 429, error: "Hourly limit" } as const, "blocked"],
    ["an expired first check", { why: "http", status: 404, error: "That first check has expired." } as const, "blocked"],
    ["quota ran out mid-check", { why: "event", event: { type: "error", message: "Hourly limit", retryable: false } } as const, "blocked"],
  ])("%s → %s", (_name, input, kind) => {
    expect(classifyFailure(input).kind).toBe(kind);
  });
  it("keeps the server's own words for photo problems and limits", () => {
    expect(classifyFailure({ why: "http", status: 429, error: "Hourly limit" }).message).toBe("Hourly limit");
    expect(classifyFailure({ why: "event", event: { type: "retake", code: "x", message: "Spread them out." } }).message).toBe("Spread them out.");
  });
});

describe("the per-request read cache", () => {
  const image = { mediaType: "image/png" as const, base64: "AAAA" };
  it("a deliberate second read of the same crop is a real read; an exact retry reuses both, in order", async () => {
    let n = 0; const reader = vi.fn(async () => ++n);
    const first = requestReadCache("photos-1")("pill", reader);
    expect([await first(image, { model: "m" }), await first(image, { model: "m" })]).toEqual([1, 2]);
    const retry = requestReadCache("photos-1")("pill", reader);
    expect([await retry(image, { model: "m" }), await retry(image, { model: "m" })]).toEqual([1, 2]);
    expect(reader).toHaveBeenCalledTimes(2);
  });
  it("a different request, reader or model never reuses a reading", async () => {
    let n = 0; const reader = vi.fn(async () => ++n);
    await requestReadCache("photos-1")("pill", reader)(image, { model: "m" });
    await requestReadCache("photos-2")("pill", reader)(image, { model: "m" });
    await requestReadCache("photos-1")("group", reader)(image, { model: "m" });
    await requestReadCache("photos-1")("pill", reader)(image, { model: "other" });
    expect(reader).toHaveBeenCalledTimes(4);
  });
  it("a failed read is not remembered, and a broken cache just reads", async () => {
    const reader = vi.fn().mockRejectedValueOnce(new Error("overloaded")).mockResolvedValue("ok");
    await expect(requestReadCache("p")("pill", reader)(image)).rejects.toThrow("overloaded");
    expect(await requestReadCache("p")("pill", reader)(image)).toBe("ok");
    const broken = { get: async () => { throw new Error("redis down"); }, set: async () => { throw new Error("redis down"); } };
    expect(await requestReadCache("p", broken)("pill", async () => "read anyway")(image)).toBe("read anyway");
  });
});

describe("overlapping reads (a retry while the cut-off request is still reading)", () => {
  const image = { mediaType: "image/png" as const, base64: "BBBB" };
  it("on the same server, the retry waits for the running read instead of paying again", async () => {
    let release!: (v: string) => void;
    const reader = vi.fn(() => new Promise<string>((resolve) => { release = resolve; }));
    const first = requestReadCache("p")("pill", reader)(image), retry = requestReadCache("p")("pill", reader)(image);
    await new Promise((r) => setTimeout(r, 10)); release("read once");
    expect(await Promise.all([first, retry])).toEqual(["read once", "read once"]);
    expect(reader).toHaveBeenCalledTimes(1);
  });
  it("on another server (pending marker taken), it waits for that answer", async () => {
    let calls = 0;
    const store = { get: async () => (++calls > 1 ? "theirs" : null), set: async () => {}, claim: async () => false };
    const reader = vi.fn(async () => "mine");
    expect(await requestReadCache("p", store)("pill", reader)(image)).toBe("theirs");
    expect(reader).not.toHaveBeenCalled();
  });
  it("if the other server's read ended without an answer, it reads itself right away", async () => {
    const store = { get: async () => null, set: async () => {}, claim: async () => false, pending: async () => false };
    const reader = vi.fn(async () => "mine");
    const started = Date.now();
    expect(await requestReadCache("p", store)("pill", reader)(image)).toBe("mine");
    expect(reader).toHaveBeenCalledTimes(1); expect(Date.now() - started).toBeLessThan(1500);
  });
  it("it releases its own marker when its read ends, even on failure", async () => {
    const released: string[] = [];
    const store = { get: async () => null, set: async () => {}, claim: async () => true, release: async (k: string) => { released.push(k); } };
    await expect(requestReadCache("p", store)("pill", async () => { throw new Error("overloaded"); })(image)).rejects.toThrow();
    expect(released).toHaveLength(1);
  });
  it("while the other server's read is alive it keeps waiting, up to the deadline only", async () => {
    const store = { get: async () => null, set: async () => {}, claim: async () => false, pending: async () => true };
    const reader = vi.fn(async () => "mine");
    expect(await requestReadCache("p", store)("pill", reader)(image, { deadline: Date.now() + 1500 })).toBe("mine");
    expect(reader).toHaveBeenCalledTimes(1);
  });
});

describe("quota the same photos already paid for", () => {
  it("each unit of a check is charged once, even when an overlapping retry asks at the same time", async () => {
    await consumeCheckLimit("ip", 1, "abc");
    await Promise.all([consumeCheckLimit("ip", 4, "abc"), consumeCheckLimit("ip", 4, "abc")]);
    await consumeCheckLimit("ip", 2, "abc");
    expect(hourlyUsedForTests("ip")).toBe(4);
    await consumeCheckLimit("ip", 2, "other");
    expect(hourlyUsedForTests("ip")).toBe(6);
  });
  it("a refused charge leaves the check unpaid: nobody gets those units for free", async () => {
    await consumeCheckLimit("ip", 8); await consumeCheckLimit("ip", 8); await consumeCheckLimit("ip", 8); // 24 of 30
    expect((await consumeCheckLimit("ip", 8, "abc")).allowed).toBe(false);
    expect((await consumeCheckLimit("ip", 6, "abc")).allowed).toBe(true); // the overlapping request pays for its own 6
    expect(hourlyUsedForTests("ip")).toBe(30);
  });
  it("one check shares its quota over 1 + 3 requests", async () => {
    expect([await joinCheck("abc"), await joinCheck("abc"), await joinCheck("abc"), await joinCheck("abc"), await joinCheck("abc")]).toEqual([true, true, true, true, false]);
  });
});

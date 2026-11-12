import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis", async (orig) => ({ ...(await orig<typeof import("@/lib/redis")>()), getRedis: () => null }));

const { cached, cacheStats, clearMemoryCache, fdaCacheKey } = await import("./cache");
const { FdaError, FDA_MAX_CONCURRENT, fetchJson, friendlyFdaMessage } = await import("./http");

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
  it("backs off on 429/5xx, honors a short Retry-After, and bounds retries", async () => {
    const pause=vi.fn(async()=>{});
    const f=vi.fn().mockResolvedValueOnce(new Response('{}',{status:429,headers:{'retry-after':'0.4'}})).mockResolvedValueOnce(json({},503)).mockResolvedValueOnce(json({ok:true}));
    await expect(fetchJson('https://x.test/retry',{fetchImpl:f,retries:2,sleepImpl:pause})).resolves.toEqual({ok:true});
    expect(pause.mock.calls).toEqual([[400],[500]]);
    const long=vi.fn().mockResolvedValue(new Response('{}',{status:429,headers:{'retry-after':'30'}}));
    await expect(fetchJson('https://x.test/cooldown',{fetchImpl:long,sleepImpl:pause})).rejects.toBeInstanceOf(FdaError);
    expect(long).toHaveBeenCalledTimes(1); // no early retry, no 30-second function stall
  });
  it("caps simultaneous FDA fetches and releases slots after failed work", async () => {
    let active=0,peak=0;
    const f=vi.fn(async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,2));active--;return json({ok:1});});
    await Promise.all(Array.from({length:20},(_,i)=>fetchJson(`https://x.test/burst/${i}`,{fetchImpl:f})));
    expect(peak).toBe(FDA_MAX_CONCURRENT);
    const failed=vi.fn(async()=>{throw new Error('network');});
    await Promise.allSettled(Array.from({length:8},()=>fetchJson('https://x.test/down',{fetchImpl:failed,retries:0})));
    await expect(fetchJson('https://x.test/recovered',{fetchImpl:f})).resolves.toEqual({ok:1});
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
  it("coalesces simultaneous misses and shares failure without caching it", async()=>{
    const load=vi.fn(async()=>{await new Promise(r=>setTimeout(r,2));return [1,2];});
    const values=await Promise.all(Array.from({length:15},()=>cached('https://x.test/same-label',load)));
    expect(values).toHaveLength(15);expect(load).toHaveBeenCalledTimes(1);
    const down=vi.fn(async()=>{await new Promise(r=>setTimeout(r,2));throw new Error('down');});
    const rejected=await Promise.allSettled(Array.from({length:15},()=>cached('https://x.test/recover-label',down)));
    expect(rejected.every(r=>r.status==='rejected')).toBe(true);expect(down).toHaveBeenCalledTimes(1);
    await expect(cached('https://x.test/recover-label',async()=>3)).resolves.toBe(3);
  });
});

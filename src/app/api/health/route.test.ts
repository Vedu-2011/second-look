import { beforeEach, describe, expect, it, vi } from "vitest";

const getRedis = vi.fn();
vi.mock("@/lib/redis", () => ({ getRedis: () => getRedis(), key: (k: string) => `sl:${k}` }));
vi.mock("next/server", () => ({ connection: async () => {} }));

const { GET } = await import("./route");

function fakeRedis() {
  const store = new Map<string, unknown>();
  return {
    set: vi.fn(async (k: string, v: unknown) => {
      store.set(k, v);
      return "OK";
    }),
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    del: vi.fn(async (k: string) => Number(store.delete(k))),
    store,
  };
}

describe("GET /api/health", () => {
  beforeEach(() => getRedis.mockReset());

  it("writes and reads a key, then reports redis: true", async () => {
    const redis = fakeRedis();
    getRedis.mockReturnValue(redis);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, redis: true });
    expect(new Date(body.time).toString()).not.toBe("Invalid Date");
    expect(redis.set).toHaveBeenCalledWith(expect.stringMatching(/^sl:health:ping:/), expect.any(String), { ex: 60 });
    expect(redis.store.size).toBe(0); // cleans up after itself
  });

  it("doesn't false-fail when two probes overlap", async () => {
    getRedis.mockReturnValue(fakeRedis());
    const [a, b] = await Promise.all([GET(), GET()]);
    expect([a.status, b.status]).toEqual([200, 200]);
  });

  it("says Redis isn't set up when there are no credentials", async () => {
    getRedis.mockReturnValue(null);
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, redis: false, error: expect.stringMatching(/isn't set up/) });
  });

  it("reports a failure when the value doesn't come back", async () => {
    getRedis.mockReturnValue({ set: vi.fn(async () => "OK"), get: vi.fn(async () => "something else"), del: vi.fn() });
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, redis: false });
  });

  it("returns a friendly error instead of throwing when Redis is down", async () => {
    getRedis.mockReturnValue({ set: vi.fn(async () => { throw new Error("ECONNREFUSED"); }), get: vi.fn() });
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, redis: false, error: "Couldn't reach Redis." });
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
  });
});

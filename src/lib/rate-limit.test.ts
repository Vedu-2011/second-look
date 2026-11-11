import { describe, expect, it } from "vitest";
import { bottleCheckUnits, clearRateLimitForTests, consumeCheckLimit, consumePreparationLimit } from "@/lib/rate-limit";

describe("check rate limit fallback", () => {
  it("free preparation is bounded separately and does not consume the paid allowance", async () => {
    const previous = process.env.DAILY_CHECK_CAP;
    process.env.DAILY_CHECK_CAP = "1";
    clearRateLimitForTests();
    try {
      for (let i = 0; i < 30; i++) expect((await consumePreparationLimit("free-preparation")).allowed).toBe(true);
      expect((await consumePreparationLimit("free-preparation")).allowed).toBe(false);
      expect((await consumeCheckLimit("free-preparation")).allowed).toBe(true);
      expect((await consumeCheckLimit("free-preparation")).allowed).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.DAILY_CHECK_CAP; else process.env.DAILY_CHECK_CAP = previous;
      clearRateLimitForTests();
    }
  });
  it("allows thirty checks and blocks the thirty-first", async () => {
    clearRateLimitForTests();
    for (let i = 0; i < 30; i++) expect((await consumeCheckLimit("test-rate-ip")).allowed).toBe(true);
    expect((await consumeCheckLimit("test-rate-ip")).allowed).toBe(false);
    clearRateLimitForTests();
  });

  it("enforces the global cap in the local fallback", async () => {
    const previous = process.env.DAILY_CHECK_CAP;
    process.env.DAILY_CHECK_CAP = "2";
    clearRateLimitForTests();
    expect((await consumeCheckLimit("daily-a")).allowed).toBe(true);
    expect((await consumeCheckLimit("daily-b")).allowed).toBe(true);
    expect((await consumeCheckLimit("daily-c")).allowed).toBe(false);
    if (previous === undefined) delete process.env.DAILY_CHECK_CAP;
    else process.env.DAILY_CHECK_CAP = previous;
    clearRateLimitForTests();
  });
});

it("reserves weighted checks atomically across concurrent bottles and the shared daily cap", async () => {
  const old = process.env.DAILY_CHECK_CAP; process.env.DAILY_CHECK_CAP = "7"; clearRateLimitForTests();
  try {
    const attempts = await Promise.all(Array.from({ length: 10 }, (_, i) => consumeCheckLimit(`weighted-${i}`, 2)));
    expect(attempts.filter((a) => a.allowed)).toHaveLength(3);
    expect((await consumeCheckLimit("last", 1)).allowed).toBe(true);
    expect((await consumeCheckLimit("over", 1)).allowed).toBe(false);
  } finally { if (old === undefined) delete process.env.DAILY_CHECK_CAP; else process.env.DAILY_CHECK_CAP = old; clearRateLimitForTests(); }
});
it("a failed weighted reservation doesn't partially spend the hourly allowance", async () => {
  clearRateLimitForTests();
  for (let i = 0; i < 29; i++) await consumeCheckLimit("no-partial");
  expect((await consumeCheckLimit("no-partial", 2)).allowed).toBe(false);
  expect((await consumeCheckLimit("no-partial")).allowed).toBe(true);
  clearRateLimitForTests();
});

it.each([[1,1],[5,1],[6,2],[9,2],[20,4]])("conservatively rounds %i detected pills to %i check units", (count, expected) => {
  expect(bottleCheckUnits(count)).toBe(expected);
});

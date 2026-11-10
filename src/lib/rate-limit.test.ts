import { describe, expect, it } from "vitest";
import { clearRateLimitForTests, consumeCheckLimit } from "@/lib/rate-limit";

describe("check rate limit fallback", () => {
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

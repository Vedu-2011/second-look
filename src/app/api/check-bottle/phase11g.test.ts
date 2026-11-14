// Phase 11g regression: a check that fails on our side is retried with the SAME photos. The retry must not pay again
// (no new AI reads, no new quota) and must still come back with the full result. A real photo problem is not retryable.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_RESULTS } from "@/lib/sample-results";
import { scene } from "@/lib/bottle/test-scenes";
import type { LabelReading, PillReading } from "@/lib/verdict-engine";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/redis", () => ({ getRedis: () => null, key: (v: string) => "sl:" + v }));
vi.mock("@/lib/rate-limit", async (original) => {
  const real = await original<typeof import("@/lib/rate-limit")>();
  return { ...real, consumePreparationLimit: vi.fn(async () => ({ allowed: true, count: 1 })), consumeCheckLimit: vi.fn(async () => ({ allowed: true, count: 1 })) };
});
vi.mock("@/lib/ai/readers", () => ({ readLabel: vi.fn(), readPill: vi.fn(), readPillGroup: vi.fn() }));
vi.mock("@/lib/check-service", () => ({ resolveLabelData: vi.fn(async () => ({})), runResolvedCheck: vi.fn() }));

const { POST } = await import("./route");
const { readLabel, readPill } = await import("@/lib/ai/readers");
const { runResolvedCheck } = await import("@/lib/check-service");
const { consumeCheckLimit, clearPaidForTests } = await import("@/lib/rate-limit");
const { clearReadCacheForTests } = await import("@/lib/ai/read-cache");
const source = SAMPLE_RESULTS[0].result;
const label = await scene(1), bottle = await scene(9), other = await scene(8);
const RETRY_ID = "a".repeat(32);
function request(pills = bottle, checkId: string | null = RETRY_ID) {
  const form = new FormData();
  if (checkId) form.set("checkId", checkId);
  form.set("labelImage", new Blob([new Uint8Array(label)], { type: "image/png" }), "label.png");
  form.set("bottleImage", new Blob([new Uint8Array(pills)], { type: "image/png" }), "bottle.png");
  return new Request("http://localhost/api/check-bottle", { method: "POST", body: form });
}
const events = async (response: Response) => (await response.text()).trim().split("\n").map((s) => JSON.parse(s));
const check = (label: LabelReading, pill: PillReading) => ({ ...structuredClone(source), label, pill, verdict: "MATCH" as const });

beforeEach(() => {
  vi.clearAllMocks(); clearReadCacheForTests(); clearPaidForTests();
  vi.mocked(readLabel).mockResolvedValue(source.label);
  vi.mocked(readPill).mockResolvedValue(source.pill);
  vi.mocked(runResolvedCheck).mockImplementation(async (l: LabelReading, p: PillReading) => check(l, p));
});

describe("phase 11g: retrying the same photos", () => {
  it("a failure on our side after every read is retryable, and the retry costs no reads and no quota", async () => {
    // First attempt: all reads done, then something on our side breaks while checking against FDA data.
    vi.mocked(runResolvedCheck).mockRejectedValueOnce(new Error("socket hang up"));
    const first = (await events(await POST(request()))).at(-1);
    expect(first).toMatchObject({ type: "error", retryable: true });
    const reads = vi.mocked(readLabel).mock.calls.length + vi.mocked(readPill).mock.calls.length, quota = vi.mocked(consumeCheckLimit).mock.calls.length;
    expect(reads).toBe(1 + 9); expect(quota).toBe(2);

    const second = (await events(await POST(request()))).at(-1);
    expect(second.type).toBe("result"); expect(second.result.pills).toHaveLength(9); expect(second.result.decision.verdict).toBe("MATCH");
    expect(vi.mocked(readLabel).mock.calls.length + vi.mocked(readPill).mock.calls.length).toBe(reads);
    expect(vi.mocked(consumeCheckLimit).mock.calls.length).toBe(quota);
  });
  it("different photos are a new check: fresh reads and fresh quota", async () => {
    await events(await POST(request()));
    vi.mocked(readPill).mockClear(); vi.mocked(consumeCheckLimit).mockClear();
    const out = (await events(await POST(request(other)))).at(-1);
    expect(out.type).toBe("result"); expect(readPill).toHaveBeenCalledTimes(8); expect(consumeCheckLimit).toHaveBeenCalled();
  });
  it("a retry that dies halfway resumes: only the reads it never finished are paid", async () => {
    let n = 0;
    vi.mocked(readPill).mockImplementation(async () => { if (++n === 6) throw Object.assign(new Error("overloaded"), { status: 529 }); return source.pill; });
    const first = (await events(await POST(request()))).at(-1);
    const firstReads = vi.mocked(readPill).mock.calls.length;
    vi.mocked(readPill).mockClear(); vi.mocked(readPill).mockResolvedValue(source.pill);
    const second = (await events(await POST(request()))).at(-1);
    expect(second.type).toBe("result");
    // Whatever the first attempt finished is reused; the retry reads at most what was left.
    expect(vi.mocked(readPill).mock.calls.length).toBeLessThanOrEqual(9 - (firstReads - 1));
    if (first.type === "error") expect(first.retryable).toBe(true);
  });
  it("only 3 free retries per check; after that it's charged like a new check", async () => {
    vi.mocked(runResolvedCheck).mockRejectedValue(new Error("socket hang up")); // every attempt fails on our side
    await events(await POST(request()));
    for (let i = 0; i < 3; i++) await events(await POST(request()));
    const before = vi.mocked(consumeCheckLimit).mock.calls.length;
    expect(before).toBe(2);
    await events(await POST(request()));
    expect(vi.mocked(consumeCheckLimit).mock.calls.length).toBeGreaterThan(before);
  });
  it("the same photos as a NEW check (new id, or none) are charged and read again: no free re-checks", async () => {
    for (const id of ["b".repeat(32), null]) {
      await events(await POST(request(bottle, "c".repeat(32))));
      vi.mocked(readPill).mockClear(); vi.mocked(consumeCheckLimit).mockClear();
      expect((await events(await POST(request(bottle, id)))).at(-1).type).toBe("result");
      expect(readPill).toHaveBeenCalledTimes(9); expect(consumeCheckLimit).toHaveBeenCalledTimes(2);
    }
  });
  it("a result the phone never received: resending that check is free, from cache, at most 3 times", async () => {
    expect((await events(await POST(request()))).at(-1).type).toBe("result");
    vi.mocked(consumeCheckLimit).mockClear(); vi.mocked(readPill).mockClear();
    for (let i = 0; i < 3; i++) expect((await events(await POST(request()))).at(-1).type).toBe("result");
    expect(consumeCheckLimit).not.toHaveBeenCalled(); expect(readPill).not.toHaveBeenCalled();
    await events(await POST(request()));
    expect(consumeCheckLimit).toHaveBeenCalled();
  });
  it("a check that runs too long ends with a retryable error, and the retry reuses what was already read", async () => {
    process.env.BOTTLE_WATCHDOG_MS = "300";
    try {
      let n = 0;
      vi.mocked(readPill).mockImplementation(async () => { if (++n > 5) await new Promise((r) => setTimeout(r, 2000)); return source.pill; });
      const started = performance.now();
      const out = await events(await POST(request()));
      expect(out.at(-1)).toEqual({ type: "error", retryable: true, message: "That took too long on our side." });
      expect(performance.now() - started).toBeLessThan(1500);
      await new Promise((r) => setTimeout(r, 2200)); // the slow reads finish in the background and are cached
    } finally { delete process.env.BOTTLE_WATCHDOG_MS; }
    vi.mocked(readPill).mockClear(); vi.mocked(readPill).mockResolvedValue(source.pill);
    expect((await events(await POST(request()))).at(-1).type).toBe("result");
    expect(readPill).toHaveBeenCalledTimes(0);
  }, 15000);
  it("every AI read gets the same deadline, inside the function limit", async () => {
    const before = Date.now();
    await events(await POST(request()));
    const deadlines = vi.mocked(readPill).mock.calls.map((c) => c[1]?.deadline as number);
    expect(new Set(deadlines).size).toBe(1);
    expect(deadlines[0] - before).toBeGreaterThan(200_000); expect(deadlines[0] - before).toBeLessThan(270_000);
    expect(vi.mocked(readLabel).mock.calls[0][1]?.deadline).toBe(deadlines[0]);
  });
  it("a photo the segmenter rejects is a retake, never a retryable error", async () => {
    const out = (await events(await POST(request(await scene(0))))).at(-1);
    expect(out.type).toBe("retake");
  });
});

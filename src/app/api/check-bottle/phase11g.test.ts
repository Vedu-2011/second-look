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
function request(pills = bottle) {
  const form = new FormData();
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
  it("only 3 free retries per set of photos; after that it's charged like a new check", async () => {
    await events(await POST(request()));
    for (let i = 0; i < 3; i++) await events(await POST(request()));
    const before = vi.mocked(consumeCheckLimit).mock.calls.length;
    expect(before).toBe(2);
    await events(await POST(request()));
    expect(vi.mocked(consumeCheckLimit).mock.calls.length).toBeGreaterThan(before);
  });
  it("a photo the segmenter rejects is a retake, never a retryable error", async () => {
    const out = (await events(await POST(request(await scene(0))))).at(-1);
    expect(out.type).toBe("retake");
  });
});

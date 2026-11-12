import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_RESULTS } from "@/lib/sample-results";
import { scene } from "@/lib/bottle/test-scenes";
import { BOTTLE_BODY_BYTES } from "@/lib/bottle/upload";
import type { LabelReading, PillReading } from "@/lib/verdict-engine";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/redis", () => ({ getRedis: () => null, key: (v: string) => "sl:" + v }));
vi.mock("@/lib/rate-limit", async (original) => ({ ...(await original<typeof import("@/lib/rate-limit")>()), consumePreparationLimit: vi.fn(async () => ({ allowed: true, count: 1 })), consumeCheckLimit: vi.fn(async () => ({ allowed: true, count: 1 })) }));
vi.mock("@/lib/ai/readers", () => ({ readLabel: vi.fn(), readPill: vi.fn(), readPillGroup: vi.fn() }));
vi.mock("@/lib/check-service", () => ({ resolveLabelData: vi.fn(async () => ({})), runResolvedCheck: vi.fn() }));

const { POST } = await import("./route");
const { readLabel, readPill, readPillGroup } = await import("@/lib/ai/readers");
const { resolveLabelData, runResolvedCheck } = await import("@/lib/check-service");
const { consumeCheckLimit } = await import("@/lib/rate-limit");
const { getBottleResult } = await import("@/lib/result-store");
const source = SAMPLE_RESULTS[0].result;
let active = 0, peak = 0;
beforeEach(() => {
  vi.clearAllMocks(); active = 0; peak = 0;
  vi.mocked(consumeCheckLimit).mockResolvedValue({ allowed: true, count: 1 });
  vi.mocked(readLabel).mockResolvedValue(source.label);
  vi.mocked(readPill).mockImplementation(async (_image, options) => {
    active++; peak = Math.max(active, peak);
    await new Promise((resolve) => setTimeout(resolve, 1));
    options?.onUsage?.("claude-sonnet-5-5", 100, 10);
    active--; return source.pill;
  });
  vi.mocked(runResolvedCheck).mockImplementation(async (label: LabelReading, pill: PillReading) => ({ ...structuredClone(source), label, pill, verdict: pill.pillVisible === false ? "UNSURE" : "MATCH" }));
});
async function request(count = 9, touching = false) {
  const form = new FormData();
  form.set("labelImage", new Blob([new Uint8Array(await scene(1))], { type: "image/png" }), "label.png");
  form.set("bottleImage", new Blob([new Uint8Array(await scene(count, { touching }))], { type: "image/png" }), "bottle.png");
  return new Request("http://localhost/api/check-bottle", { method: "POST", body: form });
}
const events = async (response: Response) => (await response.text()).trim().split("\n").map((s) => JSON.parse(s));

describe("POST /api/check-bottle", () => {
  it("streams actual progress, caps concurrent Sonnet reads at five, and resolves expected FDA data once", async () => {
    const response = await POST(await request());
    expect(response.status).toBe(200); expect(response.headers.get("content-type")).toContain("ndjson"); expect(response.headers.get("cache-control")).toBe("no-store");
    const output = await events(response);
    expect(output.filter((e) => e.type === "step").map((e) => `${e.step}:${e.state}`)).toEqual(["1:working", "1:done", "0:working", "0:done", "2:working", "2:done", "3:working", "3:done"]);
    expect(output.filter((e) => e.type === "progress").map((e) => e.completed)).toEqual([0,1,2,3,4,5,6,7,8,9]);
    expect(readLabel).toHaveBeenCalledTimes(1); expect(readPill).toHaveBeenCalledTimes(9); expect(peak).toBe(5); expect(resolveLabelData).toHaveBeenCalledTimes(1);
    expect(vi.mocked(readPill).mock.calls.every((c) => c[1]?.model === "claude-sonnet-5-5")).toBe(true);
    expect(consumeCheckLimit).toHaveBeenNthCalledWith(1, "unknown"); expect(consumeCheckLimit).toHaveBeenNthCalledWith(2, "unknown", 1);
    const terminal = output.at(-1); expect(terminal.type).toBe("result"); expect(terminal.result.usage).toHaveLength(9);
    const stored = await getBottleResult(terminal.shareId); expect(stored?.result.pills).toHaveLength(9);
    const serialized = JSON.stringify(stored); for (const forbidden of ["base64", "dataUrl", "crops", "bottleImage", "labelImage"]) expect(serialized).not.toContain(forbidden);
  });
  it("rejects the initial cap before any AI call", async () => {
    vi.mocked(consumeCheckLimit).mockResolvedValueOnce({ allowed: false, count: 30, message: "Hourly limit" });
    expect((await POST(await request())).status).toBe(429); expect(readLabel).not.toHaveBeenCalled(); expect(readPill).not.toHaveBeenCalled();
  });
  it("rejects the weighted reservation before starting any crop reader", async () => {
    vi.mocked(consumeCheckLimit).mockResolvedValueOnce({ allowed: true, count: 30 }).mockResolvedValueOnce({ allowed: false, count: 30, message: "Hourly limit" });
    const output = await events(await POST(await request()));
    expect(output.at(-1)).toEqual({ type: "error", message: "Hourly limit" }); expect(readPill).not.toHaveBeenCalled(); expect(resolveLabelData).not.toHaveBeenCalled();
  });
  it.each([0,25])("rejects %i detected pills before pill AI", async (n) => {
    const output = await events(await POST(await request(n))); expect(output.at(-1).type).toBe("retake"); expect(readPill).not.toHaveBeenCalled();
  });
  it("reads a touching pair with ONE pile read, counts it as five reads, and is never solid green", async () => {
    const entry = (x: number) => ({ center: { x, y: 0.5 }, box: { x: x - 0.12, y: 0.35, width: 0.24, height: 0.3 }, imprintSides: source.pill.imprintSides, imprintConfidence: 0.9, colors: source.pill.colors as never, colorConfidence: 0.9, shape: source.pill.shape, shapeConfidence: 0.9, form: "tablet", partlyHidden: false, photoProblems: [] });
    vi.mocked(readPillGroup).mockResolvedValueOnce({ pills: [entry(0.38), entry(0.62)], pileCount: 2, countConfidence: 0.9, somePillsMayBeHidden: false });
    const terminal = (await events(await POST(await request(9, true)))).at(-1);
    expect(terminal.type).toBe("result"); expect(readPill).toHaveBeenCalledTimes(7); expect(readPillGroup).toHaveBeenCalledTimes(1);
    expect(terminal.result.pills).toHaveLength(9);
    expect(terminal.result.pills.slice(7).every((p: { fromPile?: boolean }) => p.fromPile)).toBe(true);
    expect(terminal.result.clumps).toEqual([expect.objectContaining({ kind: "touching", pile: { read: 2, count: 2, countConfidence: 0.9, mayBeHidden: false } })]);
    expect(terminal.result.decision).toMatchObject({ verdict: "LOOKS_RIGHT", title: "The 9 pills we read match your label." });
    expect(terminal.result.decision.instruction).toContain("We read 2 in the pile; a pill hidden under another can't be seen.");
    // 7 pill reads + 5 for the pile = 12 → 3 check units, reserved before reading.
    expect(vi.mocked(consumeCheckLimit).mock.calls.at(-1)?.[1]).toBe(2);
    expect((await getBottleResult(terminal.shareId))?.result.clumps?.[0].pile).toEqual({ read: 2, count: 2, countConfidence: 0.9, mayBeHidden: false });
  });
  it("a failed pile read leaves the region circled and unread, never green", async () => {
    vi.mocked(readPillGroup).mockRejectedValueOnce(new Error("bad reading"));
    const terminal = (await events(await POST(await request(9, true)))).at(-1);
    expect(terminal.type).toBe("result"); expect(terminal.result.pills).toHaveLength(7);
    expect(terminal.result.clumps).toEqual([expect.objectContaining({ kind: "touching" })]);
    expect(terminal.result.clumps[0].pile).toBeUndefined();
    expect(terminal.result.decision).toMatchObject({ verdict: "UNSURE", matched: 7, next: "nudge" });
  });
  it("rejects an unreadable label without crop calls", async () => {
    vi.mocked(readLabel).mockResolvedValueOnce({ isPrescriptionLabel: false });
    expect((await events(await POST(await request()))).at(-1).code).toBe("not_label"); expect(readPill).not.toHaveBeenCalled();
  });
  it("a failed reader becomes UNSURE and the bottle is never green", async () => {
    vi.mocked(readPill).mockRejectedValueOnce(new Error("reader unavailable"));
    const terminal = (await events(await POST(await request()))).at(-1);
    expect(terminal.type).toBe("result"); expect(terminal.result.decision.verdict).toBe("UNSURE"); expect(terminal.result.pills[0].result.verdict).toBe("UNSURE");
  });
  it("rejects malformed/oversized bodies without relying on Content-Length", async () => {
    const invalid = await POST(new Request("http://localhost/api/check-bottle", { method: "POST", body: "bad" })); expect(invalid.status).toBe(400);
    const huge = new Request("http://localhost/api/check-bottle", { method: "POST", body: new Uint8Array(BOTTLE_BODY_BYTES + 1), headers: { "content-type": "multipart/form-data; boundary=x" } });
    expect((await POST(huge)).status).toBe(400); expect(readLabel).not.toHaveBeenCalled(); expect(readPill).not.toHaveBeenCalled();
  });
  it("keeps usage scoped to two simultaneous requests", async () => {
    const [a,b] = await Promise.all([request(3), request(3)]);
    const output = await Promise.all([POST(a).then(events), POST(b).then(events)]);
    expect(output.map((o) => o.at(-1).result.usage.length)).toEqual([3,3]);
  });
  describe("flip and snap again", () => {
    async function again(previousId: string, count = 9, token = "") {
      const form = new FormData();
      form.set("previousId", previousId);
      form.set("continuationToken", token);
      form.set("bottleImage", new Blob([new Uint8Array(await scene(count))], { type: "image/png" }), "pills.jpg");
      return new Request("http://localhost/api/check-bottle", { method: "POST", body: form });
    }
    it("an unknown or expired first check is a friendly 404 before any AI or quota", async () => {
      const response = await POST(await again("00000000-0000-4000-8000-000000000000"));
      expect(response.status).toBe(404); expect((await response.json()).error).toContain("expired");
      expect(consumeCheckLimit).not.toHaveBeenCalled(); expect(readPill).not.toHaveBeenCalled();
    });
    it("reuses the label but reads every pill before a new green result, charging only incremental quota", async () => {
      const first = (await events(await POST(await request()))).at(-1);
      const stored = await getBottleResult(first.shareId);
      stored!.result.decision.asks = [3]; // as if pill 3 had been face-down
      vi.clearAllMocks(); vi.mocked(consumeCheckLimit).mockResolvedValue({ allowed: true, count: 1 });
      const terminal = (await events(await POST(await again(first.shareId, 9, first.continuationToken)))).at(-1);
      expect(terminal.type).toBe("result");
      expect(readLabel).not.toHaveBeenCalled(); expect(readPill).toHaveBeenCalledTimes(9);
      expect(terminal.result.followUp).toMatchObject({ mode: "reread", reread: [1,2,3,4,5,6,7,8,9], reused: 0 });
      expect(consumeCheckLimit).toHaveBeenCalledTimes(2);
      expect(consumeCheckLimit).toHaveBeenNthCalledWith(2, "unknown", 1);
      expect((await getBottleResult(terminal.shareId))?.result.followUp?.reread).toEqual([1,2,3,4,5,6,7,8,9]);
    });
    it("a public share ID or a different check's private token cannot authorize continuation", async () => {
      const first = (await events(await POST(await request()))).at(-1);
      const other = (await events(await POST(await request(3)))).at(-1);
      vi.clearAllMocks();
      expect((await POST(await again(first.shareId))).status).toBe(403);
      expect((await POST(await again(first.shareId, 9, other.continuationToken))).status).toBe(403);
      expect(readPill).not.toHaveBeenCalled(); expect(consumeCheckLimit).not.toHaveBeenCalled();
      expect(JSON.stringify(await getBottleResult(first.shareId))).not.toContain(first.continuationToken);
    });
    it("quota denial while expanding a follow-up never reads carried pills or emits green", async () => {
      const first = (await events(await POST(await request()))).at(-1);
      (await getBottleResult(first.shareId))!.result.decision.asks = [3];
      vi.clearAllMocks();
      vi.mocked(consumeCheckLimit).mockResolvedValueOnce({ allowed: true, count: 1 }).mockResolvedValueOnce({ allowed: false, count: 30, message: "Hourly limit" });
      const out = await events(await POST(await again(first.shareId, 9, first.continuationToken)));
      expect(readPill).toHaveBeenCalledTimes(1); expect(out.at(-1)).toEqual({ type: "error", message: "Hourly limit" });
      expect(out.some(e => e.type === "result")).toBe(false);
    });
    it("checks every pill again when the count changed, and says so", async () => {
      const first = (await events(await POST(await request()))).at(-1);
      vi.clearAllMocks(); vi.mocked(consumeCheckLimit).mockResolvedValue({ allowed: true, count: 1 });
      const terminal = (await events(await POST(await again(first.shareId, 11, first.continuationToken)))).at(-1);
      expect(terminal.result.followUp.mode).toBe("fresh"); expect(readPill).toHaveBeenCalledTimes(11);
      expect(consumeCheckLimit).toHaveBeenNthCalledWith(2, "unknown", 2); // ceil(11 / 5) = 3 checks in all
    });
  });
});

it('charges all five independent retries and never starts a sixth', async () => {
  vi.mocked(readPill).mockResolvedValue({ ...source.pill, imprintConfidence: .6 });
  const out = await events(await POST(await request(10)));
  const r = out.at(-1).result;
  expect(readPill).toHaveBeenCalledTimes(15);
  expect(r.pills.filter((p: { doubleRead?: unknown }) => p.doubleRead)).toHaveLength(5);
  expect(vi.mocked(consumeCheckLimit).mock.calls.reduce((n,args)=>n+(args[1]??1),0)).toBe(3);
  expect(r.pills.filter((p: { doubleRead?: { agreed: boolean } }) => p.doubleRead?.agreed)).toHaveLength(5);
});
it('extra-read quota denial starts no secondary readers and emits no success', async () => {
  vi.mocked(readPill).mockResolvedValue({ ...source.pill, imprintConfidence: .6 });
  vi.mocked(consumeCheckLimit).mockResolvedValueOnce({ allowed:true,count:1 }).mockResolvedValueOnce({ allowed:true,count:2 }).mockResolvedValue({ allowed:false,count:30,message:'No extra quota' });
  const out=await events(await POST(await request(10)));
  expect(out.at(-1)).toEqual({type:'error',message:'No extra quota'});
  expect(vi.mocked(readPill).mock.calls.every(c=>!c[1]?.beforeAttempt)).toBe(true);
  expect(out.some(e=>e.type==='result')).toBe(false);
});
it('tiny-pill coaching is free, precedes label AI, and only explicit Check anyway continues', async () => {
  const sharp=(await import('sharp')).default;
  const tiny=await sharp(Buffer.from('<svg width="1200" height="1000"><rect width="1200" height="1000" fill="#333"/><ellipse cx="500" cy="500" rx="12" ry="8" fill="white"/></svg>')).png().toBuffer();
  const make=(anyway=false)=>{const f=new FormData();f.set('labelImage',new Blob([new Uint8Array(tiny)],{type:'image/png'}),'label.png');f.set('bottleImage',new Blob([new Uint8Array(tiny)],{type:'image/png'}),'pills.png');if(anyway)f.set('checkAnyway','1');return new Request('http://localhost/api/check-bottle',{method:'POST',body:f});};
  const first=await events(await POST(make()));expect(first.at(-1).type).toBe('coaching');
  expect(readLabel).not.toHaveBeenCalled();expect(readPill).not.toHaveBeenCalled();expect(consumeCheckLimit).not.toHaveBeenCalled();
  const second=await events(await POST(make(true)));expect(second.at(-1).type).toBe('result');expect(readLabel).toHaveBeenCalledTimes(1);expect(readPill).toHaveBeenCalledTimes(1);
});

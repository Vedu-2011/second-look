// Phase 12 through the real routes: label photos read before the pills (merged on the server, conflicts settled by
// the person), and more photos of pills from the same bottle. The one-photo flow must stay exactly as it was.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_RESULTS } from "@/lib/sample-results";
import { scene } from "@/lib/bottle/test-scenes";
import type { LabelReading, PillReading } from "@/lib/verdict-engine";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/redis", () => ({ getRedis: () => null, key: (v: string) => "sl:" + v }));
vi.mock("@/lib/rate-limit", async (original) => {
  const real = await original<typeof import("@/lib/rate-limit")>();
  return { ...real, consumePreparationLimit: vi.fn(async () => ({ allowed: true, count: 1 })) };
});
vi.mock("@/lib/ai/readers", () => ({ readLabel: vi.fn(), readPill: vi.fn(), readPillGroup: vi.fn() }));
vi.mock("@/lib/check-service", () => ({ resolveLabelData: vi.fn(async () => ({})), runResolvedCheck: vi.fn() }));

const { POST } = await import("./route");
const { POST: READ } = await import("../read-label/route");
const { readLabel, readPill } = await import("@/lib/ai/readers");
const { runResolvedCheck } = await import("@/lib/check-service");
const { clearNotesForTests, clearPaidForTests, clearRateLimitForTests, hourlyUsedForTests } = await import("@/lib/rate-limit");
const { clearReadCacheForTests } = await import("@/lib/ai/read-cache");
const { clearLabelSessionsForTests } = await import("@/lib/result-store");
const { LABEL_UPLOAD_BYTES: LABEL_LIMIT } = await import("@/lib/bottle/upload");
const source = SAMPLE_RESULTS[0].result;
const labelPhoto = await scene(1), sidePhoto = await scene(2), bottle = await scene(9), more = await scene(6);
const FRONT: LabelReading = { drugName: "Metformin HCl", strength: "1,000 mg", ndc: null, isPrescriptionLabel: true, confidence: { drugName: 0.9, strength: 0.9, ndc: 0, form: 0.8 } };
const SIDE: LabelReading = { drugName: "Metformin", strength: "", ndc: "70010-065", isPrescriptionLabel: false, confidence: { drugName: 0.7, strength: 0, ndc: 0.9, form: 0 } };
const blob = (b: Buffer) => new Blob([new Uint8Array(b)], { type: "image/png" });
function readLabelRequest(photo: Buffer, session?: { labelId: string; labelToken: string }) {
  const form = new FormData(); form.set("labelImage", blob(photo), "label.png");
  if (session) { form.set("labelId", session.labelId); form.set("labelToken", session.labelToken); }
  return new Request("http://localhost/api/read-label", { method: "POST", body: form });
}
function checkRequest(fields: Record<string, string>, pills = bottle) {
  const form = new FormData(); form.set("bottleImage", blob(pills), "bottle.png");
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return new Request("http://localhost/api/check-bottle", { method: "POST", body: form });
}
const events = async (response: Response) => (await response.text()).trim().split("\n").map((s) => JSON.parse(s));
let seenLabels: LabelReading[] = [];

beforeEach(() => {
  vi.clearAllMocks(); clearReadCacheForTests(); clearPaidForTests(); clearRateLimitForTests(); clearNotesForTests(); clearLabelSessionsForTests(); seenLabels = [];
  vi.mocked(readLabel).mockResolvedValue(FRONT);
  vi.mocked(readPill).mockResolvedValue(source.pill);
  vi.mocked(runResolvedCheck).mockImplementation(async (l: LabelReading, p: PillReading) => { seenLabels.push(l); return { ...structuredClone(source), label: l, pill: p, verdict: "MATCH" as const }; });
});

describe("label photos read before the pills", () => {
  it("two photos merge on the server; the check uses that label and never reads it again", async () => {
    const first = await (await READ(readLabelRequest(labelPhoto))).json();
    expect(first).toMatchObject({ photos: 1, label: FRONT, missing: ["ndc"], conflicts: [] });
    vi.mocked(readLabel).mockResolvedValueOnce(SIDE);
    const second = await (await READ(readLabelRequest(sidePhoto, first))).json();
    expect(second).toMatchObject({ labelId: first.labelId, photos: 2, label: { drugName: "Metformin HCl", strength: "1,000 mg", ndc: "70010-065", isPrescriptionLabel: true }, missing: [], conflicts: [] });
    expect(second.labelToken).toBeUndefined(); // the token is handed out once
    vi.mocked(readLabel).mockClear();
    const result = (await events(await POST(checkRequest({ labelId: first.labelId, labelToken: first.labelToken })))).at(-1);
    expect(result.type).toBe("result");
    expect(readLabel).not.toHaveBeenCalled();
    expect(result.result.label).toMatchObject({ drugName: "Metformin HCl", strength: "1,000 mg", ndc: "70010-065" });
    expect(seenLabels.every((l) => l.ndc === "70010-065")).toBe(true);
  });
  it("one label photo through the new path checks exactly like the old one", async () => {
    const read = await (await READ(readLabelRequest(labelPhoto))).json();
    const viaId = (await events(await POST(checkRequest({ labelId: read.labelId, labelToken: read.labelToken })))).at(-1);
    clearReadCacheForTests();
    const form = new FormData(); form.set("labelImage", blob(labelPhoto), "label.png"); form.set("bottleImage", blob(bottle), "bottle.png");
    const old = (await events(await POST(new Request("http://localhost/api/check-bottle", { method: "POST", body: form })))).at(-1);
    expect(viaId.result.label).toEqual(old.result.label);
    expect(viaId.result.decision).toEqual(old.result.decision);
  });
  it("photos that disagree on the strength: the check refuses until the person picks, then uses their pick", async () => {
    const first = await (await READ(readLabelRequest(labelPhoto))).json();
    vi.mocked(readLabel).mockResolvedValueOnce({ ...FRONT, strength: "500 mg" });
    const second = await (await READ(readLabelRequest(sidePhoto, first))).json();
    expect(second.conflicts).toEqual([{ field: "strength", options: [{ value: "1,000 mg", photos: [0] }, { value: "500 mg", photos: [1] }] }]);
    expect(second.label.strength).toBeUndefined();
    const refused = await POST(checkRequest({ labelId: first.labelId, labelToken: first.labelToken }));
    expect(refused.status).toBe(409);
    const picked = (await events(await POST(checkRequest({ labelId: first.labelId, labelToken: first.labelToken, labelChoices: JSON.stringify({ strength: 1 }) })))).at(-1);
    expect(picked.result.label.strength).toBe("500 mg");
  });
  it("a reading can't be borrowed: wrong token, unknown id, a fourth photo", async () => {
    const first = await (await READ(readLabelRequest(labelPhoto))).json();
    expect((await POST(checkRequest({ labelId: first.labelId, labelToken: "f".repeat(64) }))).status).toBe(403);
    expect((await POST(checkRequest({ labelId: crypto.randomUUID(), labelToken: first.labelToken }))).status).toBe(404);
    expect((await READ(readLabelRequest(sidePhoto, { labelId: first.labelId, labelToken: "0".repeat(64) }))).status).toBe(403);
    await READ(readLabelRequest(sidePhoto, first)); await READ(readLabelRequest(await scene(3), first));
    expect((await READ(readLabelRequest(await scene(4), first))).status).toBe(400);
  });
  it("an oversized label upload is refused while it streams, with no Content-Length to trust", async () => {
    const big = new Uint8Array(LABEL_LIMIT + 200_000), boundary = "x";
    const head = new TextEncoder().encode(`--${boundary}\r\nContent-Disposition: form-data; name="labelImage"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`);
    const body = new ReadableStream({ start(c) { c.enqueue(head); for (let i = 0; i < big.length; i += 65536) c.enqueue(big.subarray(i, i + 65536)); c.close(); } });
    const response = await READ(new Request("http://localhost/api/read-label", { method: "POST", body, headers: { "content-type": `multipart/form-data; boundary=${boundary}` }, duplex: "half" } as RequestInit));
    expect(response.status).toBe(400); expect(readLabel).not.toHaveBeenCalled();
  });
  it("not a prescription label: said on the label step, before any pill is read", async () => {
    vi.mocked(readLabel).mockResolvedValue({ isPrescriptionLabel: false });
    const read = await (await READ(readLabelRequest(labelPhoto))).json();
    expect(read.exit).toMatchObject({ code: "not_label" });
    expect(readPill).not.toHaveBeenCalled();
  });
  it("the first label photo is free (it was always part of the check); each extra one is one unit", async () => {
    const first = await (await READ(readLabelRequest(labelPhoto))).json();
    expect(hourlyUsedForTests("unknown")).toBe(0);
    await READ(readLabelRequest(sidePhoto, first));
    expect(hourlyUsedForTests("unknown")).toBe(1);
  });
  it("a label read that fails on our side says so and can be retried (the browser then falls back to the old path)", async () => {
    vi.mocked(readLabel).mockRejectedValueOnce(new Error("overloaded"));
    const failed = await READ(readLabelRequest(labelPhoto));
    expect(failed.status).toBe(502); expect(await failed.json()).toMatchObject({ retryable: true });
  });
});

describe("more pills from the same bottle", () => {
  async function firstPhoto() {
    const form = new FormData(); form.set("labelImage", blob(labelPhoto), "label.png"); form.set("bottleImage", blob(bottle), "bottle.png");
    return (await events(await POST(new Request("http://localhost/api/check-bottle", { method: "POST", body: form })))).at(-1);
  }
  it("photo 2 reuses the label (no new label read), is a normal check, and links photo 1", async () => {
    const first = await firstPhoto();
    vi.mocked(readLabel).mockClear(); const before = hourlyUsedForTests("unknown");
    const second = (await events(await POST(checkRequest({ morePillsOf: first.shareId, continuationToken: first.continuationToken }, more)))).at(-1);
    expect(second.type).toBe("result");
    expect(readLabel).not.toHaveBeenCalled();
    expect(second.result.photos).toEqual([first.shareId]);
    expect(second.result.pills.map((p: { number: number }) => p.number)).toEqual([1, 2, 3, 4, 5, 6]); // numbers restart per photo
    expect(hourlyUsedForTests("unknown") - before).toBe(2); // 6 pills = 2 units, like any check
    const third = (await events(await POST(checkRequest({ morePillsOf: second.shareId, continuationToken: second.continuationToken }, more)))).at(-1);
    expect(third.result.photos).toEqual([first.shareId, second.shareId]);
    expect((await POST(checkRequest({ morePillsOf: third.shareId, continuationToken: third.continuationToken }, more))).status).toBe(400); // 3 photos at most
  });
  it("only the browser that made the check can add to it", async () => {
    const first = await firstPhoto();
    expect((await POST(checkRequest({ morePillsOf: first.shareId, continuationToken: "a".repeat(64) }, more))).status).toBe(403);
  });
  it("a flip on photo 2 keeps the link to photo 1", async () => {
    const first = await firstPhoto();
    const second = (await events(await POST(checkRequest({ morePillsOf: first.shareId, continuationToken: first.continuationToken }, more)))).at(-1);
    const flipped = (await events(await POST(checkRequest({ previousId: second.shareId, continuationToken: second.continuationToken }, more)))).at(-1);
    expect(flipped.type).toBe("result"); expect(flipped.result.photos).toEqual([first.shareId]);
  });
});

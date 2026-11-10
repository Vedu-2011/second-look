import { describe, expect, it, vi } from "vitest";
import { buildSamples, type SampleBuildDependencies } from "./samples-build";
import { SAMPLE_RESULTS } from "./sample-results";
import { templateExplanation } from "./ai/guard";

const result = SAMPLE_RESULTS[2].result;
function dependencies(): SampleBuildDependencies {
  return { readPair: vi.fn(async () => null), prepare: vi.fn(async (bytes: Uint8Array) => ({ bytes, image: { mediaType: "image/jpeg" as const, base64: "fixture" } })), check: vi.fn(async () => ({ ok: true as const, result, explanation: templateExplanation(result), timings: { ...result.timings, ai: 1 } })), save: vi.fn(async () => {}) };
}
describe("sample photo builder", () => {
  it("keeps all saved samples and avoids AI calls when folders are empty", async () => {
    const deps = dependencies();
    expect((await buildSamples(deps)).map(r => r.status)).toEqual(["kept", "kept", "kept"]);
    expect(deps.check).not.toHaveBeenCalled(); expect(deps.save).not.toHaveBeenCalled();
  });
  it("prepares both images and saves the actual computed result and date", async () => {
    const deps = dependencies();
    vi.mocked(deps.readPair).mockImplementation(async id => id === "mismatch" ? { label: new Uint8Array([1]), pill: new Uint8Array([2]) } : null);
    const outcomes = await buildSamples(deps);
    expect(deps.prepare).toHaveBeenCalledTimes(2); expect(outcomes[2]).toMatchObject({ id: "mismatch", status: "saved", verdict: "MISMATCH" });
    expect(deps.save).toHaveBeenCalledWith("mismatch", expect.objectContaining({ result, recordedAt: expect.any(String) }), expect.any(Object));
  });
  it("does not replace a saved sample when reading fails", async () => {
    const deps = dependencies(); vi.mocked(deps.readPair).mockRejectedValue(new Error("Missing pill.jpg"));
    expect((await buildSamples(deps)).every(r => r.status === "failed")).toBe(true);
    expect(deps.save).not.toHaveBeenCalled();
  });
  it("keeps the previous result when AI requests a retake", async () => {
    const deps = dependencies(); vi.mocked(deps.readPair).mockResolvedValue({ label: new Uint8Array(), pill: new Uint8Array() });
    vi.mocked(deps.check).mockResolvedValue({ ok: false, exit: { kind: "pill", code: "no_pill", message: "Retake the photo" } });
    expect((await buildSamples(deps))[0]).toMatchObject({ status: "failed", error: "Retake the photo" }); expect(deps.save).not.toHaveBeenCalled();
  });
});

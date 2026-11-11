import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_RESULTS } from "./sample-results";
import { decide } from "./verdict-engine";
const mocks = vi.hoisted(() => ({
  label: vi.fn(),
  pill: vi.fn(),
  check: vi.fn(),
  explain: vi.fn(),
}));
vi.mock("./ai/readers", () => ({
  readLabel: mocks.label,
  readPill: mocks.pill,
}));
vi.mock("./check-service", () => ({ runCheck: mocks.check }));
vi.mock("./ai/explain", () => ({ explain: mocks.explain }));
import { runPhotoCheck, finishPhotoCheck } from "./photo-check";
const sample = SAMPLE_RESULTS[0].result;
const image = { mediaType: "image/jpeg" as const, base64: "fixture" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.label.mockResolvedValue({ ...sample.label, isPrescriptionLabel: true });
  mocks.pill.mockResolvedValue({
    ...sample.pill,
    pillVisible: true,
    multiplePills: false,
  });
  mocks.check.mockImplementation(async (label, pill) => ({
    ...sample,
    ...decide(label, pill, {
      labelProduct: sample.labelProduct,
      sameDrugProducts: [sample.labelProduct!],
    }),
    label,
    pill,
  }));
  mocks.explain.mockResolvedValue({
    summary: "Computed facts",
    pharmacyScript: "Please check.",
  });
});
describe("optional second-side flow", () => {
  it("asks before explanation when no text is read", async () => {
    mocks.pill.mockResolvedValue({
      ...sample.pill,
      pillVisible: true,
      imprintSides: [],
      imprintConfidence: 0,
    });
    const r = await runPhotoCheck(image, image, () => {}, true);
    expect(r).toMatchObject({
      ok: false,
      reason: expect.any(String),
      flip: { verdict: "UNSURE" },
    });
    expect(mocks.explain).not.toHaveBeenCalled();
  });
  it("keeps sample-builder behavior noninteractive", async () => {
    const r = await runPhotoCheck(image, image);
    expect(r.ok).toBe(true);
  });
  it("skip reuses first reading and does not call a reader", async () => {
    await finishPhotoCheck(sample, null);
    expect(mocks.label).not.toHaveBeenCalled();
    expect(mocks.pill).not.toHaveBeenCalled();
    expect(mocks.check).not.toHaveBeenCalled();
    expect(mocks.explain).toHaveBeenCalledOnce();
  });
  it("reads only the new photo, combines evidence, and reuses the label", async () => {
    const previous = {
      ...sample,
      pill: {
        ...sample.pill,
        imprintSides: [],
        imprintConfidence: 0,
        pillVisible: true,
      },
    };
    const r = await finishPhotoCheck(previous, image);
    expect(mocks.label).not.toHaveBeenCalled();
    expect(mocks.pill).toHaveBeenCalledOnce();
    expect(r.result.pill).toMatchObject({
      viewCount: 2,
      imprintSides: sample.pill.imprintSides,
    });
  });
  it("conflicting second-side appearance remains unsure", async () => {
    mocks.pill.mockResolvedValue({
      ...sample.pill,
      pillVisible: true,
      colors: ["white"],
    });
    expect((await finishPhotoCheck(sample, image)).result.verdict).toBe(
      "UNSURE",
    );
  });
  it("does not ask a person to flip when multiple pills are visible", async () => {
    mocks.pill.mockResolvedValue({
      ...sample.pill,
      pillVisible: true,
      multiplePills: true,
    });
    expect(await runPhotoCheck(image, image, () => {}, true)).toMatchObject({
      ok: false,
      exit: { code: "multiple_pills" },
    });
  });
});

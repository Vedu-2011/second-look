import { LABEL_IDS, type LabelId } from "@/lib/demo-labels";
import type { ImageInput } from "@/lib/ai/client";
import type { runPhotoCheck } from "@/lib/photo-check";
import type { PhotoSample } from "@/lib/samples";

type Prepared = { bytes: Uint8Array; image: ImageInput };
export type SampleBuildDependencies = {
  readPair: (id: LabelId) => Promise<{ label: Uint8Array; pill: Uint8Array } | null>;
  prepare: (bytes: Uint8Array) => Promise<Prepared>;
  check: typeof runPhotoCheck;
  save: (id: LabelId, checked: Omit<PhotoSample, "photos">, images: { label: Prepared; pill: Prepared }) => Promise<void>;
};

export async function buildSamples(deps: SampleBuildDependencies) {
  const outcomes: { id: LabelId; status: "kept" | "saved" | "failed"; verdict?: string; error?: string }[] = [];
  for (const id of LABEL_IDS) {
    try {
      const pair = await deps.readPair(id);
      if (!pair) { outcomes.push({ id, status: "kept" }); continue; }
      const [label, pill] = await Promise.all([deps.prepare(pair.label), deps.prepare(pair.pill)]);
      const checked = await deps.check(label.image, pill.image);
      if (!checked.ok) throw new Error(checked.exit.message);
      await deps.save(id, { result: checked.result, explanation: checked.explanation, recordedAt: new Date().toISOString() }, { label, pill });
      outcomes.push({ id, status: "saved", verdict: checked.result.verdict });
    } catch (error) { outcomes.push({ id, status: "failed", error: error instanceof Error ? error.message : "Could not build this sample." }); }
  }
  return outcomes;
}

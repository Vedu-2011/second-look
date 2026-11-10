import { readLabel, readPill } from "@/lib/ai/readers";
import type { ImageInput } from "@/lib/ai/client";
import { explain } from "@/lib/ai/explain";
import { earlyExit, type CheckEvent } from "@/lib/check-input";
import { runCheck } from "@/lib/check-service";

/** Shared by uploaded checks and the real-photo sample recorder. AI reads; runCheck decides. */
export async function runPhotoCheck(labelImage: ImageInput, pillImage: ImageInput, send: (event: CheckEvent) => void = () => {}) {
  const started = performance.now();
  send({ type: "step", step: 0, state: "working" });
  send({ type: "step", step: 1, state: "working" });
  const [label, pill] = await Promise.all([readLabel(labelImage), readPill(pillImage)]);
  send({ type: "reading", kind: "label", value: label });
  send({ type: "reading", kind: "pill", value: pill });
  send({ type: "step", step: 0, state: "done" });
  send({ type: "step", step: 1, state: "done" });
  const exit = earlyExit(label, pill);
  if (exit) {
    send({ type: "step", step: exit.kind === "label" ? 0 : 1, state: "failed" });
    send({ type: "early_exit", ...exit });
    return { ok: false as const, exit };
  }
  send({ type: "step", step: 2, state: "working" });
  const result = await runCheck(label, pill);
  send({ type: "step", step: 2, state: "done" });
  send({ type: "step", step: 3, state: "working" });
  const explanation = await explain(result);
  return { ok: true as const, result, explanation, timings: { ...result.timings, ai: Math.round(performance.now() - started) } };
}

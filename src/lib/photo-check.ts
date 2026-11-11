import { readLabel, readPill } from "@/lib/ai/readers";
import type { ImageInput } from "@/lib/ai/client";
import { explain } from "@/lib/ai/explain";
import { earlyExit, type CheckEvent } from "@/lib/check-input";
import { runCheck } from "@/lib/check-service";
import type { CheckResult } from "./check-service";
import { flipReason, mergePillViews } from "./pill-views";

export type PhotoCheckDependencies = Partial<{ readLabel: typeof readLabel; readPill: typeof readPill; explain: typeof explain }>;

/** Shared by uploaded checks and the real-photo sample recorder. AI reads; runCheck decides. */
export async function runPhotoCheck(
  labelImage: ImageInput,
  pillImage: ImageInput,
  send: (event: CheckEvent) => void = () => {},
  askFlip = false,
  deps: PhotoCheckDependencies = {},
) {
  const started = performance.now();
  send({ type: "step", step: 0, state: "working" });
  send({ type: "step", step: 1, state: "working" });
  const [label, pill] = await Promise.all([
    (deps.readLabel ?? readLabel)(labelImage),
    (deps.readPill ?? readPill)(pillImage),
  ]);
  send({ type: "reading", kind: "label", value: label });
  send({ type: "reading", kind: "pill", value: pill });
  send({ type: "step", step: 0, state: "done" });
  send({ type: "step", step: 1, state: "done" });
  const exit = earlyExit(label, pill);
  if (exit && !(askFlip && exit.code === "imprint_down")) {
    send({
      type: "step",
      step: exit.kind === "label" ? 0 : 1,
      state: "failed",
    });
    send({ type: "early_exit", ...exit });
    return { ok: false as const, exit };
  }
  send({ type: "step", step: 2, state: "working" });
  const result = await runCheck(label, pill);
  send({ type: "step", step: 2, state: "done" });
  const reason = askFlip ? flipReason(pill, result.expected) : null;
  if (reason) return { ok: false as const, flip: result, reason };
  send({ type: "step", step: 3, state: "working" });
  const explanation = await (deps.explain ?? explain)(result);
  return {
    ok: true as const,
    result,
    explanation,
    timings: { ...result.timings, ai: Math.round(performance.now() - started) },
  };
}

export async function finishPhotoCheck(
  previous: CheckResult,
  otherImage: ImageInput | null,
  send: (event: CheckEvent) => void = () => {},
  deps: PhotoCheckDependencies = {},
) {
  let result = previous;
  if (otherImage) {
    send({ type: "step", step: 1, state: "working" });
    const other = await (deps.readPill ?? readPill)(otherImage);
    const pill = mergePillViews([previous.pill, other]);
    send({ type: "reading", kind: "pill", value: pill });
    send({ type: "step", step: 1, state: "done" });
    send({ type: "step", step: 2, state: "working" });
    result = await runCheck(previous.label, pill);
    send({ type: "step", step: 2, state: "done" });
  }
  send({ type: "step", step: 3, state: "working" });
  return {
    ok: true as const,
    result,
    explanation: await (deps.explain ?? explain)(result),
    timings: result.timings,
  };
}

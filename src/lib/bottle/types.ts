import type { CheckResult } from "@/lib/check-service";
import type { LabelReading } from "@/lib/verdict-engine";

/** Fractions of the EXIF-oriented original; independent of display size. */
export type NormalizedBox = { x: number; y: number; width: number; height: number };
export type BottlePill = { number: number; box: NormalizedBox; result: CheckResult; appearanceWarning?: string };
export type BottleDecision = {
  verdict: "MATCH" | "MISMATCH" | "WARNING" | "UNSURE";
  title: string;
  instruction: string;
  matched: number;
  unreadable: number;
  flagged: number[];
};
export type BottleResult = {
  kind: "bottle";
  label: LabelReading;
  pills: BottlePill[];
  decision: BottleDecision;
  image: { width: number; height: number };
  checkedAt: string;
  elapsedMs: number;
  usage: { model: string; inputTokens: number; outputTokens: number; estimatedUsd: number | null }[];
};
export type BottleEvent =
  | { type: "step"; step: 0 | 1 | 2 | 3; state: "working" | "done" | "failed" }
  | { type: "segmented"; boxes: NormalizedBox[]; image: { width: number; height: number } }
  | { type: "progress"; completed: number; total: number }
  | { type: "retake"; message: string; code: string }
  | { type: "error"; message: string }
  | { type: "result"; result: BottleResult; shareId: string };

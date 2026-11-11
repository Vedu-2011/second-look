import type { CheckResult } from "@/lib/check-service";
import type { LabelReading } from "@/lib/verdict-engine";

/** Fractions of the EXIF-oriented original; independent of display size. */
export type NormalizedBox = { x: number; y: number; width: number; height: number };
/** Measured from the pill's silhouette (no AI). Lengths are working-image pixels; compare pills only within a photo. */
export type PillFeatures = { length: number; width: number; aspect: number; area: number; relativeArea: number; lab: [number, number, number] };
/** Something we circle but don't read: pills touching each other, or a pill cut off at the photo's edge. */
export type BottleClump = { kind: "touching" | "cutoff"; box: NormalizedBox };
export type BottlePill = {
  number: number; box: NormalizedBox; result: CheckResult; appearanceWarning?: string;
  features?: PillFeatures;
  /** Unlike the main group in this photo, e.g. "a different shape and size". */
  odd?: string;
  /** Blank face up, label medicine has writing, and it looks like the imprint-confirmed pills. Not confirmed. */
  faceDown?: boolean;
  /** Re-read after "Flip and snap again". */
  reread?: boolean;
  /** History only: position matching cannot confirm the current pill. */
  carried?: boolean;
  /** Display provenance only; never current confirmation. */
  previousVerdict?: CheckResult["verdict"];
};
export type BottleDecision = {
  /** FACE_DOWN: the only open question is pills with their writing face-down (calm, not a warning). */
  verdict: "MATCH" | "MISMATCH" | "WARNING" | "UNSURE" | "FACE_DOWN";
  title: string;
  instruction: string;
  matched: number;
  unreadable: number;
  flagged: number[];
  /** Pills we ask to flip where they are (never more than 3). */
  asks?: number[];
  /** What the next photo is for: flip circled pills, nudge clumps apart, or pour again. */
  next?: "flip" | "nudge" | "flip_and_nudge" | "pour_again";
};
export type BottleResult = {
  kind: "bottle";
  label: LabelReading;
  pills: BottlePill[];
  clumps?: BottleClump[];
  decision: BottleDecision;
  /** Present after "Flip and snap again": what was re-read and what was kept. */
  followUp?: { mode: "reread" | "fresh"; reread: number[]; reused: number; note: string };
  image: { width: number; height: number };
  checkedAt: string;
  elapsedMs: number;
  unresolvedRegions?: number;
  usage: { model: string; inputTokens: number; outputTokens: number; estimatedUsd: number | null }[];
};
export type BottleEvent =
  | { type: "step"; step: 0 | 1 | 2 | 3; state: "working" | "done" | "failed" }
  | { type: "segmented"; boxes: NormalizedBox[]; image: { width: number; height: number } }
  | { type: "progress"; completed: number; total: number }
  | { type: "retake"; message: string; code: string }
  | { type: "error"; message: string }
  | { type: "result"; result: BottleResult; shareId: string; continuationToken?: string };

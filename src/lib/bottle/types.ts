import type { CheckResult } from "@/lib/check-service";
import type { LabelReading } from "@/lib/verdict-engine";

/** Fractions of the EXIF-oriented original; independent of display size. */
export type NormalizedBox = { x: number; y: number; width: number; height: number };
/** Measured from the pill's silhouette (no AI). Lengths are working-image pixels; compare pills only within a photo. */
/**
 * Where the pill itself is, for drawing a ring ON it: center (fractions of the photo), long-axis angle (radians,
 * y down) and length/width as fractions of the photo's WIDTH (the overlay keeps the photo's aspect ratio).
 */
export type PillOutline = { cx: number; cy: number; angle: number; length: number; width: number };
export type PillFeatures = { length: number; width: number; aspect: number; area: number; relativeArea: number; lab: [number, number, number] };
/** Something we circle but don't read: pills touching each other, or a pill cut off at the photo's edge. */
export type BottleClump = {
  kind: "touching" | "cutoff"; box: NormalizedBox;
  /** Touching pills read together by the pile reader. Absent = never read (a dashed "Not read" circle). */
  pile?: BottlePile;
  /** Cutoff only: small and much darker than every pill, mostly outside the photo. Shown as a note, still never green. */
  minor?: boolean;
  /** Touching only: the region's area divided by a typical separate pill's area. */
  relativeArea?: number;
  /** A "touching" region about one pill in size that the single-pill reader read as ONE pill (it is that pill now). */
  readAsOne?: boolean;
};
/** What the pile reader saw in one touching region. `read` pills became numbered pills (fromPile). */
export type BottlePile = { read: number; count: number; countConfidence: number; mayBeHidden: boolean };
export type BottlePill = {
  number: number; box: NormalizedBox; result: CheckResult; appearanceWarning?: string;
  features?: PillFeatures;
  /** The pill's own measured silhouette (separate pills only). Older results don't have it. */
  outline?: PillOutline;
  /** A "touching" region about one pill in size, read as one pill by the single-pill reader. */
  fromRegion?: boolean;
  /** Pile pills: the group reader's box couldn't be trusted, so we don't draw a mark on a guessed spot. */
  boxGuessed?: boolean;
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
  consensus?: { confirmedNumbers: number[]; partialConsistent: boolean };
  /** Read by the pile reader from a crop of touching pills (no silhouette features). */
  fromPile?: boolean;
  /** Imprint confirmed; only its 2-D shape looked different (a tilted capsule). A note, not a warning. */
  shapeNote?: boolean;
  doubleRead?: { agreed: boolean; partial?: boolean; failed?: boolean; firstConfidence: number; secondConfidence: number; firstImprint: string[]; secondImprint: string[] };
};
export type BottleDecision = {
  /** FACE_DOWN: the only open question is pills with their writing face-down (calm, not a warning). */
  verdict: "MATCH" | "MISMATCH" | "WARNING" | "UNSURE" | "FACE_DOWN" | "LOOKS_RIGHT";
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
  /** Highest pill number used so far in this check (follow-ups), so a removed pill's number is never given out again. */
  highestNumber?: number;
  image: { width: number; height: number };
  checkedAt: string;
  elapsedMs: number;
  unresolvedRegions?: number;
  usage: { model: string; inputTokens: number; outputTokens: number; estimatedUsd: number | null }[];
};
export type BottleEvent =
  | { type: "coaching"; tips: string[] }
  | { type: "step"; step: 0 | 1 | 2 | 3; state: "working" | "done" | "failed" }
  | { type: "segmented"; boxes: NormalizedBox[]; image: { width: number; height: number } }
  | { type: "progress"; completed: number; total: number }
  | { type: "retake"; message: string; code: string }
  /** retryable: our side failed (not the photo): the browser retries the SAME photos once, then offers "Try again". */
  | { type: "error"; message: string; retryable?: boolean }
  | { type: "result"; result: BottleResult; shareId: string; continuationToken?: string };

import { z } from "zod";
import type { LabelReading, PillReading } from "@/lib/verdict-engine";

export const imagePayloadSchema = z.object({
  dataUrl: z.string().min(30).max(3_000_000),
});

export const checkRequestSchema = z.object({
  labelImage: imagePayloadSchema,
  pillImage: imagePayloadSchema,
});

export const CHECK_BODY_MAX = 4_000_000;

export type CheckRequest = z.infer<typeof checkRequestSchema>;

export type CheckEvent =
  | { type: "step"; step: 0 | 1 | 2 | 3; state: "working" | "done" | "failed" }
  | { type: "reading"; kind: "label" | "pill"; value: LabelReading | PillReading }
  | { type: "early_exit"; kind: "label" | "pill"; code: string; message: string }
  | { type: "result"; result: unknown; explanation: unknown; timings: Record<string, number> }
  | { type: "error"; message: string };

export function parseImageDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Please send a JPG, PNG, GIF, or WebP image.");
  const [, mediaType, base64] = match;
  const bytes = Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
  if (bytes > 4 * 1024 * 1024) throw new Error("That photo is too large. Choose a photo under 4 MB.");
  return { mediaType: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", base64 };
}

export function earlyExit(label: LabelReading, pill: PillReading) {
  if (label.isPrescriptionLabel === false || (!label.drugName && !label.ndc)) return { kind: "label" as const, code: "not_label", message: "We couldn't find a medicine on that label. Retake the photo with the whole pharmacy label flat, in good light." };
  if ((label.confidence?.drugName ?? 1) < 0.55) return { kind: "label" as const, code: "label_unreadable", message: "We couldn't read the medicine name. Retake the label photo closer, flatter, and in better light." };
  if (!pill.pillVisible) return { kind: "pill" as const, code: "no_pill", message: "We couldn't see a pill. Retake the photo with one pill on a plain surface." };
  if (pill.multiplePills) return { kind: "pill" as const, code: "multiple_pills", message: "We saw more than one pill. Retake the photo with just one pill in the frame." };
  if ((pill.photoProblems ?? []).includes("imprint side down")) return { kind: "pill" as const, code: "imprint_down", message: "The imprint side may be facing down. Turn one pill over and retake the photo." };
  return null;
}

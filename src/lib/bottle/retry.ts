// Phase 11g: what went wrong with a bottle check, from the browser's side. Only a photo problem sends you back to the
// camera. A failure on our side (network drop, timeout, stream cut short, 5xx, a retryable server error) keeps both
// photos, retries the SAME photos once by itself, then offers "Try again".
import type { BottleEvent } from "./types";

export type FailureKind = "photo" | "ours" | "blocked";
export type CheckFailure = { kind: FailureKind; message: string; why: string; status?: number };

export const RETRYING_MESSAGE = "That took too long on our side — trying again…";
export const OURS_MESSAGE = "We couldn't finish this check on our side. Your photos are still here, so you can try again.";

export type FailureInput =
  | { why: "event"; event: Extract<BottleEvent, { type: "retake" | "error" }> }
  | { why: "http"; status: number; error?: string }
  | { why: "too-large"; message: string }
  | { why: "network" | "timeout" | "ended-early" | "bad-stream" };

export function classifyFailure(input: FailureInput): CheckFailure {
  switch (input.why) {
    case "event":
      if (input.event.type === "retake") return { kind: "photo", message: input.event.message, why: "retake" };
      return input.event.retryable
        ? { kind: "ours", message: OURS_MESSAGE, why: "server-error" }
        : { kind: "blocked", message: input.event.message, why: "server-error" };
    case "http":
      // 400 = the server couldn't open the photos; 403/404/429 = continuation or limits: retrying now won't help.
      if (input.status === 400) return { kind: "photo", message: input.error || "We couldn't open those photos. Please choose them again.", why: "http", status: 400 };
      if ([403, 404, 429].includes(input.status)) return { kind: "blocked", message: input.error || "We couldn't start this check.", why: "http", status: input.status };
      return { kind: "ours", message: OURS_MESSAGE, why: "http", status: input.status };
    case "too-large":
      return { kind: "photo", message: input.message, why: "too-large" };
    default:
      return { kind: "ours", message: OURS_MESSAGE, why: input.why };
  }
}

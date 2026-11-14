import { createHash, randomBytes } from "node:crypto";
import { connection } from "next/server";
import sharp from "sharp";
import { AiUnavailableError } from "@/lib/ai/client";
import { requestReadCache } from "@/lib/ai/read-cache";
import { readLabel, readPill, readPillGroup } from "@/lib/ai/readers";
import { BottleQuotaError, runBottleCheck, runBottleFollowUp } from "@/lib/bottle/check-bottle";
import { captureCoaching } from "@/lib/bottle/coaching";
import { segmentBottle, SegmentationError } from "@/lib/bottle/segment";
import { MAX_BOTTLE_PIXELS } from "@/lib/bottle/segment";
import { BOTTLE_BODY_BYTES, BOTTLE_UPLOAD_BYTES, LABEL_UPLOAD_BYTES } from "@/lib/bottle/upload";
import type { BottleEvent } from "@/lib/bottle/types";
import { friendlyFdaMessage } from "@/lib/fda/http";
import { bottleCheckUnits, consumeCheckLimit, consumePreparationLimit, priorReservation, recordReservation, releaseReservation } from "@/lib/rate-limit";
import { canContinueBottle, getBottleResult, saveBottleResult, type StoredBottleResult } from "@/lib/result-store";

// Hobby allows up to 300 s. A 17-pill photo measures ~6–7 rounds of reads (phase 11g); this is headroom, not the plan.
export const maxDuration = 300;
const MAX_BODY = BOTTLE_BODY_BYTES;
const supported = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const encoder = new TextEncoder();

/** Bound streamed bytes too, rather than trusting Content-Length or buffering unlimited uploads. */
async function boundedForm(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) throw new Error("Choose a label photo and a whole-bottle photo.");
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) throw new Error("Those photos are too large. Use a bottle photo under 3 MB and a label under 0.7 MB.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Please choose both photos again.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); throw new Error("Those photos are too large. Use a bottle photo under 3 MB and a label under 0.7 MB."); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return new Response(Buffer.concat(chunks), { headers: { "content-type": request.headers.get("content-type")! } }).formData();
}
export async function POST(request: Request) {
  await connection();
  let label: { mediaType: "image/jpeg"; base64: string } | null = null, bottle: Buffer, previousId = "", continuationToken = "", checkAnyway = false, checkId = "";
  try {
    const form = await boundedForm(request);
    checkAnyway = form.get("checkAnyway") === "1";
    // The browser makes one id per check and resends it ONLY when it retries that check after a failure on our side.
    const id = form.get("checkId");
    checkId = typeof id === "string" && /^[a-f0-9]{32}$/.test(id) ? id : "";
    const labelFile = form.get("labelImage"), bottleFile = form.get("bottleImage"), previous = form.get("previousId");
    // "Flip and snap again" sends only the new pills photo plus the first check's saved id; the label is reused.
    continuationToken = typeof form.get("continuationToken") === "string" ? String(form.get("continuationToken")) : "";
    previousId = typeof previous === "string" && /^[0-9a-f-]{36}$/i.test(previous) ? previous : "";
    if (!(bottleFile instanceof File) || !supported.has(bottleFile.type) || (!previousId && (!(labelFile instanceof File) || !supported.has(labelFile.type)))) throw new Error("Choose JPG, PNG, WebP, or GIF photographs for both steps.");
    if (bottleFile.size > BOTTLE_UPLOAD_BYTES || (labelFile instanceof File && labelFile.size > LABEL_UPLOAD_BYTES)) throw new Error("Use a label under 0.7 MB and a bottle photo under 3 MB.");
    if (!previousId && labelFile instanceof File) {
      const decoded = sharp(Buffer.from(await labelFile.arrayBuffer()), { limitInputPixels: MAX_BOTTLE_PIXELS });
      const meta = await decoded.metadata();
      if ((meta.pages ?? 1) > 1) throw new Error("Choose a still label photograph.");
      label = { mediaType: "image/jpeg", base64: (await decoded.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()).toString("base64") };
    }
    bottle = Buffer.from(await bottleFile.arrayBuffer());
  } catch {
    return Response.json({ error: "We couldn't open those photos. Choose a still JPG, PNG, WebP, or GIF: label under 0.7 MB, bottle under 3 MB and 32 megapixels." }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  // Only results this server saved can be continued; nothing the browser sends is trusted as a reading.
  let previous: StoredBottleResult | null = null;
  if (previousId) {
    previous = await getBottleResult(previousId);
    if (!previous) return Response.json({ error: "That first check has expired. Start a new check with the label photo." }, { status: 404, headers: { "cache-control": "no-store" } });
    if (!canContinueBottle(previous, continuationToken)) return Response.json({ error: "Continue from the browser that made this check, or start a new check with your label photo." }, { status: 403, headers: { "cache-control": "no-store" } });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const preparation = await consumePreparationLimit(ip);
  if (!preparation.allowed) return Response.json({ error: preparation.message }, { status: 429, headers: { "cache-control": "no-store" } });
  let prepared;
  try { prepared = await segmentBottle(bottle); }
  catch (error) {
    const event: BottleEvent = { type: "retake", code: error instanceof SegmentationError ? error.code : "image", message: error instanceof SegmentationError ? error.message : "We couldn't open that photograph. Please choose it again." };
    return new Response(JSON.stringify(event) + "\n", { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
  }
  const tips = captureCoaching(prepared);
  if (tips.length && !checkAnyway) return new Response(JSON.stringify({ type: "coaching", tips }) + "\n", { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
  // A retry of one check (same check id AND same photos) reuses what it already reserved and read. Without an id, or
  // with new photos, it's a new check: fresh quota and fresh reads. A finished check releases its reservation.
  const photoHash = createHash("sha256").update(`${checkId || randomBytes(16).toString("hex")}\n${previousId}\n${checkAnyway ? 1 : 0}\n${label?.base64.length ?? 0}\n`).update(label?.base64 ?? "").update(bottle).digest("hex");
  const prior = checkId ? await priorReservation(photoHash) : 0;
  if (!prior) {
    const initial = await consumeCheckLimit(ip);
    if (!initial.allowed) return Response.json({ error: initial.message }, { status: 429, headers: { "cache-control": "no-store" } });
    if (checkId) await recordReservation(photoHash, 1);
  }
  let canceled = false, reservedUnits = Math.max(1, prior);
  // Readings (never photos) are cached by image hash, so a retry of the same photos doesn't pay for them again.
  const cache = requestReadCache(photoHash);
  const readers = { readLabel: cache("label", readLabel), readPill: cache("pill", readPill), readPillGroup: cache("group", readPillGroup) };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: BottleEvent) => { if (!canceled) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); };
      void (async () => {
        try {
          // A re-snap counts like a check of the pills it re-reads: max(1, ceil(rereads / 5)).
          const reserve = async (count: number) => {
            if (canceled || request.signal.aborted) throw new BottleQuotaError("The check was canceled. Please start again.");
            const units = bottleCheckUnits(count), extra = Math.max(0, units - reservedUnits);
            if (extra) { const reserved = await consumeCheckLimit(ip, extra); if (!reserved.allowed) throw new BottleQuotaError(reserved.message); reservedUnits = units; if (checkId) await recordReservation(photoHash, units); }
          };
          const result = previous ? await runBottleFollowUp(previous.result, bottle, reserve, send, { prepared, checkAnyway: true, ...readers }) : await runBottleCheck(label!, bottle, reserve, send, { prepared, checkAnyway: true, ...readers });
          if (result && !canceled) {
            const continuationToken = randomBytes(32).toString("hex");
            send({ type: "result", result, shareId: await saveBottleResult(result, continuationToken), continuationToken });
            if (checkId) await releaseReservation(photoHash);
          }
        } catch (error) {
          // Keep the real exception, but never log request bodies, photos, label readings or SDK headers.
          console.error("Bottle check failed", error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : { name: "UnknownError", message: "Non-Error thrown" });
          // Quota and "AI isn't set up" won't fix themselves; anything else on our side is worth one more try.
          const retryable = !(error instanceof BottleQuotaError) && !(error instanceof AiUnavailableError);
          send({ type: "error", retryable, message: error instanceof BottleQuotaError ? error.message : error instanceof AiUnavailableError ? "Photo reading is unavailable right now. Try one pill or a saved sample." : friendlyFdaMessage(error) });
        } finally { if (!canceled) controller.close(); }
      })();
    },
    cancel() { canceled = true; },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}

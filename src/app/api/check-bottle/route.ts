import { randomBytes } from "node:crypto";
import { connection } from "next/server";
import sharp from "sharp";
import { AiUnavailableError } from "@/lib/ai/client";
import { BottleQuotaError, runBottleCheck, runBottleFollowUp } from "@/lib/bottle/check-bottle";
import { MAX_BOTTLE_PIXELS } from "@/lib/bottle/segment";
import { BOTTLE_BODY_BYTES, BOTTLE_UPLOAD_BYTES, LABEL_UPLOAD_BYTES } from "@/lib/bottle/upload";
import type { BottleEvent } from "@/lib/bottle/types";
import { friendlyFdaMessage } from "@/lib/fda/http";
import { bottleCheckUnits, consumeCheckLimit } from "@/lib/rate-limit";
import { canContinueBottle, getBottleResult, saveBottleResult, type StoredBottleResult } from "@/lib/result-store";

export const maxDuration = 120;
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
  let label: { mediaType: "image/jpeg"; base64: string } | null = null, bottle: Buffer, previousId = "", continuationToken = "";
  try {
    const form = await boundedForm(request);
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
  const initial = await consumeCheckLimit(ip);
  if (!initial.allowed) return Response.json({ error: initial.message }, { status: 429, headers: { "cache-control": "no-store" } });
  let canceled = false, reservedUnits = 1;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: BottleEvent) => { if (!canceled) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); };
      void (async () => {
        try {
          // A re-snap counts like a check of the pills it re-reads: max(1, ceil(rereads / 5)).
          const reserve = async (count: number) => {
            if (canceled || request.signal.aborted) throw new BottleQuotaError("The check was canceled. Please start again.");
            const units = bottleCheckUnits(count), extra = Math.max(0, units - reservedUnits);
            if (extra) { const reserved = await consumeCheckLimit(ip, extra); if (!reserved.allowed) throw new BottleQuotaError(reserved.message); reservedUnits = units; }
          };
          const result = previous ? await runBottleFollowUp(previous.result, bottle, reserve, send) : await runBottleCheck(label!, bottle, reserve, send);
          if (result && !canceled) {
            const continuationToken = randomBytes(32).toString("hex");
            send({ type: "result", result, shareId: await saveBottleResult(result, continuationToken), continuationToken });
          }
        } catch (error) {
          send({ type: "error", message: error instanceof BottleQuotaError ? error.message : error instanceof AiUnavailableError ? "Photo reading is unavailable right now. Try one pill or a saved sample." : friendlyFdaMessage(error) });
        } finally { if (!canceled) controller.close(); }
      })();
    },
    cancel() { canceled = true; },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}

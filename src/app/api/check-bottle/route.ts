import { createHash, randomBytes } from "node:crypto";
import { connection } from "next/server";
import sharp from "sharp";
import { AiUnavailableError, type ImageInput, type ReadOptions } from "@/lib/ai/client";
import { requestReadCache } from "@/lib/ai/read-cache";
import { readLabel, readPill, readPillGroup } from "@/lib/ai/readers";
import { BottleQuotaError, runBottleCheck, runBottleFollowUp } from "@/lib/bottle/check-bottle";
import { captureCoaching } from "@/lib/bottle/coaching";
import { segmentBottle, SegmentationError } from "@/lib/bottle/segment";
import { MAX_BOTTLE_PIXELS } from "@/lib/bottle/segment";
import { BOTTLE_BODY_BYTES, BOTTLE_UPLOAD_BYTES, LABEL_UPLOAD_BYTES } from "@/lib/bottle/upload";
import type { BottleEvent } from "@/lib/bottle/types";
import { friendlyFdaMessage } from "@/lib/fda/http";
import { bottleCheckUnits, consumeCheckLimit, consumePreparationLimit, joinCheck } from "@/lib/rate-limit";
import { MAX_PILL_PHOTOS } from "@/lib/bottle/combine";
import { KEY_FIELDS, mergeLabelReadings, type LabelChoices } from "@/lib/bottle/label-merge";
import type { LabelReading } from "@/lib/verdict-engine";
import { canContinueBottle, canUseLabelSession, getBottleResult, getLabelSession, saveBottleResult, type StoredBottleResult } from "@/lib/result-store";

// Hobby allows up to 300 s. A 17-pill photo measures ~6–7 rounds of reads (phase 11g); this is headroom, not the plan.
export const maxDuration = 300;
/** End the stream with a retryable error before the platform kills the function; reads finished so far stay cached. */
const WATCHDOG_MS = 270_000, READ_DEADLINE_MS = 262_000;
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
  let labelId = "", labelToken = "", labelChoices: LabelChoices = {}, morePillsOf = "";
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
    // Phase 12: the label may already be read (label id + token, plus the person's picks where photos disagreed), or
    // these are more pills from a bottle already checked ("more pills of" that result, with its token).
    const id12 = (name: string) => { const v = form.get(name); return typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : ""; };
    labelId = previousId ? "" : id12("labelId"); morePillsOf = previousId ? "" : id12("morePillsOf");
    labelToken = typeof form.get("labelToken") === "string" ? String(form.get("labelToken")) : "";
    try { const picks = JSON.parse(String(form.get("labelChoices") ?? "{}")); for (const f of KEY_FIELDS) if (Number.isInteger(picks?.[f])) labelChoices[f] = picks[f]; } catch { labelChoices = {}; }
    const labelKnown = Boolean(previousId || labelId || morePillsOf);
    if (!(bottleFile instanceof File) || !supported.has(bottleFile.type) || (!labelKnown && (!(labelFile instanceof File) || !supported.has(labelFile.type)))) throw new Error("Choose JPG, PNG, WebP, or GIF photographs for both steps.");
    if (bottleFile.size > BOTTLE_UPLOAD_BYTES || (labelFile instanceof File && labelFile.size > LABEL_UPLOAD_BYTES)) throw new Error("Use a label under 0.7 MB and a bottle photo under 3 MB.");
    if (!labelKnown && labelFile instanceof File) {
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
  // A label read before the pills: only readings this server made, merged with the person's picks.
  let declaredLabel: LabelReading | undefined, photos: string[] | undefined;
  if (labelId) {
    const session = await getLabelSession(labelId);
    if (!session) return Response.json({ error: "Your label reading has expired. Take the label photo again." }, { status: 404, headers: { "cache-control": "no-store" } });
    if (!canUseLabelSession(session, labelToken)) return Response.json({ error: "Continue from the browser that took the label photo, or start a new check." }, { status: 403, headers: { "cache-control": "no-store" } });
    const merged = mergeLabelReadings(session.readings, labelChoices);
    if (merged.conflicts.length) return Response.json({ error: "Your label photos disagree. Pick which reading is on your label first." }, { status: 409, headers: { "cache-control": "no-store" } });
    declaredLabel = merged.label;
  }
  if (morePillsOf) {
    const earlier = await getBottleResult(morePillsOf);
    if (!earlier) return Response.json({ error: "That check has expired. Start a new check with the label photo." }, { status: 404, headers: { "cache-control": "no-store" } });
    if (!canContinueBottle(earlier, continuationToken)) return Response.json({ error: "Continue from the browser that made this check, or start a new check with your label photo." }, { status: 403, headers: { "cache-control": "no-store" } });
    photos = [...(earlier.result.photos ?? []), morePillsOf];
    if (photos.length >= MAX_PILL_PHOTOS) return Response.json({ error: `You can check up to ${MAX_PILL_PHOTOS} photos of pills from one bottle.` }, { status: 400, headers: { "cache-control": "no-store" } });
    declaredLabel = earlier.result.label;
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
  // A retry of one check (same check id AND same photos) shares what that check already reserved and read, even while
  // the original is still running. Without an id, or with new photos, it's a new check: fresh quota and fresh reads.
  // Kept after a result too (the phone may never have received it); 1 + 3 requests per check, within 15 minutes.
  const photoHash = createHash("sha256").update(`${checkId || randomBytes(16).toString("hex")}\n${previousId}\n${checkAnyway ? 1 : 0}\n${labelId}\n${JSON.stringify(labelChoices)}\n${morePillsOf}\n${label?.base64.length ?? 0}\n`).update(label?.base64 ?? "").update(bottle).digest("hex");
  const shared = checkId ? await joinCheck(photoHash) : false;
  let reservedUnits = 0;
  /** Reserve up to `units` for this request; in a shared check only units nobody has paid for are charged (atomically). */
  const reserveUnits = async (units: number) => {
    if (units <= reservedUnits) return null;
    const reserved = shared ? await consumeCheckLimit(ip, units, photoHash) : await consumeCheckLimit(ip, units - reservedUnits);
    if (!reserved.allowed) return reserved;
    reservedUnits = units;
    return null;
  };
  const initial = await reserveUnits(1);
  if (initial) return Response.json({ error: initial.message }, { status: 429, headers: { "cache-control": "no-store" } });
  let canceled = false;
  // Readings (never photos) are cached by image hash, so a retry of the same photos doesn't pay for them again.
  const cache = requestReadCache(photoHash);
  const deadline = Date.now() + READ_DEADLINE_MS;
  const timed = <T,>(reader: (image: ImageInput, options: ReadOptions) => Promise<T>) => (image: ImageInput, options: ReadOptions = {}) => reader(image, { ...options, deadline });
  const readers = { readLabel: cache("label", timed(readLabel)), readPill: cache("pill", timed(readPill)), readPillGroup: cache("group", timed(readPillGroup)) };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: BottleEvent) => { if (!canceled) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); };
      const watchdog = setTimeout(() => {
        if (canceled) return;
        console.error("Bottle check failed", { name: "Watchdog", message: `Still running after ${Number(process.env.BOTTLE_WATCHDOG_MS) || WATCHDOG_MS} ms` });
        send({ type: "error", retryable: true, message: "That took too long on our side." });
        canceled = true; controller.close();
      }, Number(process.env.BOTTLE_WATCHDOG_MS) || WATCHDOG_MS);
      void (async () => {
        try {
          // A re-snap counts like a check of the pills it re-reads: max(1, ceil(rereads / 5)).
          const reserve = async (count: number) => {
            if (canceled || request.signal.aborted) throw new BottleQuotaError("The check was canceled. Please start again.");
            const denied = await reserveUnits(bottleCheckUnits(count));
            if (denied) throw new BottleQuotaError(denied.message);
          };
          const result = previous ? await runBottleFollowUp(previous.result, bottle, reserve, send, { prepared, checkAnyway: true, ...readers })
            : await runBottleCheck(label ?? { mediaType: "image/jpeg", base64: "" }, bottle, reserve, send, { prepared, checkAnyway: true, ...readers, ...(declaredLabel ? { label: declaredLabel } : {}) });
          if (result && photos) result.photos = photos;
          if (result && !canceled) {
            const continuationToken = randomBytes(32).toString("hex");
            send({ type: "result", result, shareId: await saveBottleResult(result, continuationToken), continuationToken });
          }
        } catch (error) {
          // Keep the real exception, but never log request bodies, photos, label readings or SDK headers.
          console.error("Bottle check failed", error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : { name: "UnknownError", message: "Non-Error thrown" });
          // Quota and "AI isn't set up" won't fix themselves; anything else on our side is worth one more try.
          const retryable = !(error instanceof BottleQuotaError) && !(error instanceof AiUnavailableError);
          send({ type: "error", retryable, message: error instanceof BottleQuotaError ? error.message : error instanceof AiUnavailableError ? "Photo reading is unavailable right now. Try one pill or a saved sample." : friendlyFdaMessage(error) });
        } finally { clearTimeout(watchdog); if (!canceled) controller.close(); }
      })();
    },
    cancel() { canceled = true; },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}

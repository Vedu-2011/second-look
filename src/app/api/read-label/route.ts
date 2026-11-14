// Phase 12: read one label photo before the pills, so the person sees what we read and can add a photo of the part
// that wraps around the bottle (up to three). Readings are kept on the server under a label id; the browser only
// holds a token for them and can never send a reading of its own. Photos are not kept.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { connection } from "next/server";
import sharp from "sharp";
import { AiUnavailableError, DEFAULT_VISION_MODEL } from "@/lib/ai/client";
import { requestReadCache } from "@/lib/ai/read-cache";
import { readLabel } from "@/lib/ai/readers";
import { MAX_LABEL_PHOTOS, mergeLabelReadings } from "@/lib/bottle/label-merge";
import { MAX_BOTTLE_PIXELS } from "@/lib/bottle/segment";
import { LABEL_UPLOAD_BYTES } from "@/lib/bottle/upload";
import { earlyExit } from "@/lib/check-input";
import { unreadablePill } from "@/lib/bottle/check-bottle";
import { allowLabelRead, consumeCheckLimit, consumePreparationLimit } from "@/lib/rate-limit";
import { canUseLabelSession, getLabelSession, saveLabelSession } from "@/lib/result-store";

export const maxDuration = 60;
const supported = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BODY = LABEL_UPLOAD_BYTES + 64 * 1024;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  await connection();
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) return json({ error: "Use a label photo under 0.7 MB." }, 400);
  let image: { mediaType: "image/jpeg"; base64: string }, labelId = "", labelToken = "";
  try {
    const form = await request.formData();
    const file = form.get("labelImage"), id = form.get("labelId"), token = form.get("labelToken");
    labelId = typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? id : "";
    labelToken = typeof token === "string" ? token : "";
    if (!(file instanceof File) || !supported.has(file.type) || file.size > LABEL_UPLOAD_BYTES) throw new Error("bad file");
    const decoded = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: MAX_BOTTLE_PIXELS });
    if (((await decoded.metadata()).pages ?? 1) > 1) throw new Error("animated");
    image = { mediaType: "image/jpeg", base64: (await decoded.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()).toString("base64") };
  } catch {
    return json({ error: "We couldn't open that label photo. Choose a still JPG, PNG, WebP, or GIF under 0.7 MB." }, 400);
  }
  const session = labelId ? await getLabelSession(labelId) : null;
  if (labelId && !session) return json({ error: "Your label reading has expired. Take the label photo again." }, 404);
  if (session && !canUseLabelSession(session, labelToken)) return json({ error: "Continue from the browser that took the first label photo, or start a new check." }, 403);
  if (session && session.readings.length >= MAX_LABEL_PHOTOS) return json({ error: `You can add up to ${MAX_LABEL_PHOTOS} photos of the label.` }, 400);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const preparation = await consumePreparationLimit(ip);
  if (!preparation.allowed) return json({ error: preparation.message }, 429);
  // The first label photo is part of a normal check; each extra one counts as a check unit of its own.
  if (session) { const extra = await consumeCheckLimit(ip, 1); if (!extra.allowed) return json({ error: extra.message }, 429); }
  else if (!(await allowLabelRead(ip))) return json({ error: "You have read a lot of labels this hour. Please try again later." }, 429);
  let reading;
  try {
    // A retry of the same photo for the same label reuses the reading instead of paying again.
    const scope = createHash("sha256").update(`label\n${labelId}\n`).update(image.base64).digest("hex");
    reading = await requestReadCache(scope)("label", readLabel)(image, { model: DEFAULT_VISION_MODEL });
  } catch (error) {
    console.error("Label read failed", error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" });
    if (error instanceof AiUnavailableError) return json({ error: "Photo reading is unavailable right now. Try one pill or a saved sample." }, 503);
    return json({ error: "We couldn't read the label on our side.", retryable: true }, 502);
  }
  const id = labelId || randomUUID(), token = labelId ? labelToken : randomBytes(32).toString("hex");
  const readings = [...(session?.readings ?? []), reading];
  await saveLabelSession(id, readings, token);
  const merged = mergeLabelReadings(readings);
  const exit = merged.conflicts.length ? null : earlyExit(merged.label, { ...unreadablePill(), pillVisible: true });
  return json({ labelId: id, ...(labelId ? {} : { labelToken: token }), photos: readings.length, label: merged.label, conflicts: merged.conflicts, missing: merged.missing, ...(exit ? { exit: { code: exit.code, message: exit.message } } : {}) });
}

// Phase 11g: when a bottle check fails before the server ever sees it (a phone's upload dropping), our logs had nothing.
// The browser now sends a tiny note here: what kind of failure, never photos, readings or labels.
import { allowFailureNote } from "@/lib/rate-limit";

const MAX_BODY = 2000;
/** Reads at most MAX_BODY bytes, whatever Content-Length says; null if the body is bigger. */
async function smallBody(request: Request): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const part = await reader.read(); if (part.done) break;
    size += part.value.byteLength;
    if (size > MAX_BODY) { await reader.cancel().catch(() => {}); return null; }
    chunks.push(part.value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
const text = (v: unknown, n = 160) => typeof v === "string" ? v.slice(0, n) : undefined;
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? Math.round(v) : undefined;

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  // Our notes are a few hundred bytes; anything bigger, or past the per-IP limit, isn't read or logged.
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY || !(await allowFailureNote(ip))) return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  let body: Record<string, unknown> = {};
  const raw = await smallBody(request).catch(() => null);
  if (raw === null) return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  try { const parsed = JSON.parse(raw); if (parsed && typeof parsed === "object") body = parsed; } catch {}
  console.warn("Bottle check failed in the browser", JSON.stringify({
    why: text(body.why, 40), kind: text(body.kind, 20), status: num(body.status), name: text(body.name, 60), message: text(body.message),
    attempt: num(body.attempt), elapsedMs: num(body.elapsedMs), bytes: num(body.bytes), online: typeof body.online === "boolean" ? body.online : undefined,
    followUp: body.followUp === true, userAgent: request.headers.get("user-agent")?.slice(0, 160),
  }));
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

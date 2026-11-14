// Phase 11g: when a bottle check fails before the server ever sees it (a phone's upload dropping), our logs had nothing.
// The browser now sends a tiny note here: what kind of failure, never photos, readings or labels.
import { allowFailureNote } from "@/lib/rate-limit";

const MAX_BODY = 2000;
const text = (v: unknown, n = 160) => typeof v === "string" ? v.slice(0, n) : undefined;
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? Math.round(v) : undefined;

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  // Our notes are a few hundred bytes; anything bigger, or past the per-IP limit, isn't read or logged.
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY || !(await allowFailureNote(ip))) return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  let body: Record<string, unknown> = {};
  try { const raw = (await request.text()).slice(0, MAX_BODY); const parsed = JSON.parse(raw); if (parsed && typeof parsed === "object") body = parsed; } catch {}
  console.warn("Bottle check failed in the browser", JSON.stringify({
    why: text(body.why, 40), kind: text(body.kind, 20), status: num(body.status), name: text(body.name, 60), message: text(body.message),
    attempt: num(body.attempt), elapsedMs: num(body.elapsedMs), bytes: num(body.bytes), online: typeof body.online === "boolean" ? body.online : undefined,
    followUp: body.followUp === true, userAgent: request.headers.get("user-agent")?.slice(0, 160),
  }));
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

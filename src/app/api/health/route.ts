import { connection } from "next/server";
import { getRedis } from "@/lib/redis";

// Writes a key to Redis and reads it back, so a deploy can prove its database actually works.
export async function GET() {
  await connection(); // always run at request time, never prerendered
  const time = new Date().toISOString();
  const redis = getRedis();
  if (!redis) {
    return Response.json({ ok: false, redis: false, time, error: "Redis isn't set up for this deployment." }, { status: 503 });
  }
  try {
    const value = `${time}:${Math.random().toString(36).slice(2, 10)}`;
    await redis.set("health:ping", value, { ex: 300 });
    const back = await redis.get<string>("health:ping");
    const ok = back === value;
    return Response.json(
      ok ? { ok, redis: true, time } : { ok, redis: false, time, error: "Redis answered, but the value didn't come back." },
      { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json({ ok: false, redis: false, time, error: "Couldn't reach Redis." }, { status: 503 });
  }
}

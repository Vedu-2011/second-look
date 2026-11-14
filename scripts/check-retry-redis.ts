// Phase 11g: exercise the retry pieces against the REAL shared Redis (our "sl:" prefix, test keys only, deleted after).
// Usage: npm run diag:retry-redis
import { randomBytes } from "node:crypto";
import { getRedis, key } from "@/lib/redis";
import { claimUnits, joinCheck, releaseReservation, returnUnits } from "@/lib/rate-limit";
import { defaultReadStore, requestReadCache } from "@/lib/ai/read-cache";
(async () => {
  const redis = getRedis();
  if (!redis) { console.error("Redis is not configured here."); process.exitCode = 1; return; }
  const hash = randomBytes(32).toString("hex"), check = (name: string, ok: boolean) => { console.log(ok ? "ok  " : "FAIL", name); if (!ok) process.exitCode = 1; };
  check("first unit is charged", await claimUnits(hash, 1) === 1);
  check("overlapping claims charge each unit once", JSON.stringify(await Promise.all([claimUnits(hash, 4), claimUnits(hash, 4)]).then((r) => r.sort())) === "[0,3]");
  await returnUnits(hash, 2);
  check("returned units can be claimed again", await claimUnits(hash, 4) === 2);
  check("1 + 3 shared requests, then not", JSON.stringify([await joinCheck(hash), await joinCheck(hash), await joinCheck(hash), await joinCheck(hash), await joinCheck(hash)]) === "[true,true,true,true,false]");
  await releaseReservation(hash);
  check("released", await redis.exists(key(`paid:${hash}`)) === 0);
  const scope = `diag-${hash}`, image = { mediaType: "image/png" as const, base64: "AAAA" };
  let reads = 0; const reader = async () => ({ n: ++reads });
  // The real Redis store, recording exactly which keys this run writes, so cleanup touches nothing else.
  const real = defaultReadStore(), made = new Set<string>();
  const store = { ...real, set: async (k: string, v: unknown) => { made.add(k); await real.set(k, v); }, claim: async (k: string) => { made.add(`${k}:pending`); return real.claim!(k); } };
  const first = requestReadCache(scope, store)("pill", reader);
  const a = await first(image, { model: "m" }), b = await first(image, { model: "m" });
  const retry = requestReadCache(scope, store)("pill", reader);
  const c = await retry(image, { model: "m" }), d = await retry(image, { model: "m" });
  check("second read is real, retry reuses both in order", JSON.stringify([a, b, c, d]) === JSON.stringify([{ n: 1 }, { n: 2 }, { n: 1 }, { n: 2 }]) && reads === 2);
  const markers = [...made].filter((k) => k.endsWith(":pending"));
  check("no pending markers left behind", (await Promise.all(markers.map((k) => redis.exists(k)))).every((n) => n === 0));
  // Clean up only the keys this run wrote.
  for (const k of made) await redis.del(k);
  console.log(`cleaned ${made.size} keys this run made`);
})();

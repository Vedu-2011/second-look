// Phase 11g: exercise the retry pieces against the REAL shared Redis (our "sl:" prefix, test keys only, deleted after).
// Usage: npm run diag:retry-redis
import { randomBytes } from "node:crypto";
import { getRedis, key } from "@/lib/redis";
import { priorReservation, recordReservation, releaseReservation } from "@/lib/rate-limit";
import { requestReadCache } from "@/lib/ai/read-cache";
(async () => {
  const redis = getRedis();
  if (!redis) { console.error("Redis is not configured here."); process.exitCode = 1; return; }
  const hash = randomBytes(32).toString("hex"), check = (name: string, ok: boolean) => { console.log(ok ? "ok  " : "FAIL", name); if (!ok) process.exitCode = 1; };
  check("no reservation yet", await priorReservation(hash) === 0);
  await recordReservation(hash, 1); await recordReservation(hash, 4); await recordReservation(hash, 2);
  check("highest reservation kept, 3 free retries", JSON.stringify([await priorReservation(hash), await priorReservation(hash), await priorReservation(hash)]) === "[4,4,4]");
  check("4th retry is charged", await priorReservation(hash) === 0);
  await releaseReservation(hash);
  check("released", await redis.exists(key(`paid:${hash}`)) === 0);
  const scope = `diag-${hash}`, image = { mediaType: "image/png" as const, base64: "AAAA" };
  let reads = 0; const reader = async () => ({ n: ++reads });
  const first = requestReadCache(scope)("pill", reader);
  const a = await first(image, { model: "m" }), b = await first(image, { model: "m" });
  const retry = requestReadCache(scope)("pill", reader);
  const c = await retry(image, { model: "m" }), d = await retry(image, { model: "m" });
  check("second read is real, retry reuses both in order", JSON.stringify([a, b, c, d]) === JSON.stringify([{ n: 1 }, { n: 2 }, { n: 1 }, { n: 2 }]) && reads === 2);
  const keys: string[] = []; let cursor: string | number = 0;
  do { const [next, batch]: [string | number, string[]] = await redis.scan(cursor, { match: key("read:*"), count: 500 }); cursor = next; keys.push(...batch); } while (String(cursor) !== "0");
  check("no pending markers left behind", !keys.some((k) => k.endsWith(":pending")));
  // Clean up only what this script made: the two reads under its own scope (found by value), then the paid key.
  const mine = (await Promise.all(keys.map(async (k) => ({ k, v: await redis.get<{ n: number }>(k) })))).filter((r) => r.v && typeof r.v === "object" && "n" in r.v);
  for (const r of mine) await redis.del(r.k);
  console.log(`cleaned ${mine.length} test reading keys`);
})();

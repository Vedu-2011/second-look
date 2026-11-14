import { getRedis, key } from "@/lib/redis";

const memory = new Map<string, { count: number; expires: number }>();
const dailyMemory = new Map<string, { count: number; expires: number }>();
export type LimitResult = { allowed: true; count: number } | { allowed: false; message: string; count: number };
export const bottleCheckUnits = (pills: number) => Math.max(1, Math.ceil(pills / 5));
const hourMessage = "You have reached the hourly limit. Please try again later.";
const dayMessage = "The checking service has reached today's limit. Please try again tomorrow.";

// Both counters are checked AND incremented in one transaction, including concurrent weighted reservations.
const RESERVE = `
local h = tonumber(redis.call('GET', KEYS[1]) or '0')
local d = tonumber(redis.call('GET', KEYS[2]) or '0')
local n = tonumber(ARGV[1])
if h+n > 30 then return {0,h,1} end
if d+n > tonumber(ARGV[2]) then return {0,h,2} end
h = redis.call('INCRBY', KEYS[1], n)
d = redis.call('INCRBY', KEYS[2], n)
redis.call('EXPIRE', KEYS[1], 3600)
redis.call('EXPIRE', KEYS[2], 172800)
return {1,h,0}
`;
export async function consumeCheckLimit(ip: string, units = 1): Promise<LimitResult> {
  // A bottle can reserve 20 single reads + three 5-unit piles + five second reads = 8 check units.
  // The previous four-unit guard predated pile reads and threw before the shared counters were checked.
  if (!Number.isInteger(units) || units < 1 || units > 8) throw new Error("Invalid check reservation");
  const now = Date.now(), hour = Math.floor(now / 3_600_000), daily = new Date(now).toISOString().slice(0, 10);
  const safeIp = ip.replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, 100) || "unknown";
  const cap = Number(process.env.DAILY_CHECK_CAP || 500);
  const dayCap = Number.isFinite(cap) && cap >= 0 ? Math.floor(cap) : 500;
  const hourKey = key(`rate:${safeIp}:${hour}`), dayKey = key(`daily:${daily}`);
  const redis = getRedis();
  if (redis) {
    try {
      const [allowed, count, reason] = await redis.eval<[number, number], [number, number, number]>(RESERVE, [hourKey, dayKey], [units, dayCap]);
      return allowed === 1 ? { allowed: true, count } : { allowed: false, count, message: reason === 1 ? hourMessage : dayMessage };
    } catch {
      // A local fallback here would bypass the shared cap across server instances.
      return { allowed: false, count: 0, message: "We couldn't reserve a check right now. Please try again shortly." };
    }
  }
  for (const map of [memory, dailyMemory]) for (const [k, v] of map) if (v.expires <= now) map.delete(k);
  const h = memory.get(hourKey)?.count ?? 0, d = dailyMemory.get(dayKey)?.count ?? 0;
  // No await between checking and incrementing: atomic within this local server instance.
  if (h + units > 30) return { allowed: false, count: h, message: hourMessage };
  if (d + units > dayCap) return { allowed: false, count: h, message: dayMessage };
  memory.set(hourKey, { count: h + units, expires: (hour + 1) * 3_600_000 });
  dailyMemory.set(dayKey, { count: d + units, expires: now + 172_800_000 });
  return { allowed: true, count: h + units };
}
export function clearRateLimitForTests() { memory.clear(); dailyMemory.clear(); preparationMemory.clear(); }

// Free preparation is separate from paid-reading quota; bounded to stop repeated segmentation abuse.
const preparationMemory = new Map<string, { count: number; expires: number }>();
export async function consumePreparationLimit(ip: string): Promise<LimitResult> {
  const now = Date.now(), slot = Math.floor(now / 60_000);
  const k = key(`prepare:${ip.replace(/[^a-zA-Z0-9:._-]/g, '_').slice(0,100)}:${slot}`);
  const redis = getRedis();
  if (redis) {
    try {
      const count = await redis.eval<[], number>("local n=redis.call('INCR', KEYS[1]); redis.call('EXPIRE', KEYS[1],120); return n", [k], []);
      return count <= 30 ? { allowed: true, count } : { allowed: false, count, message: 'Please wait a minute before preparing another photo.' };
    } catch { return { allowed: false, count: 0, message: 'We could not prepare a check right now. Please try again shortly.' }; }
  }
  for (const [name, v] of preparationMemory) if (v.expires <= now) preparationMemory.delete(name);
  const count = (preparationMemory.get(k)?.count ?? 0) + 1;
  preparationMemory.set(k, { count, expires: now + 120_000 });
  return count <= 30 ? { allowed: true, count } : { allowed: false, count, message: 'Please wait a minute before preparing another photo.' };
}

// Phase 11g: after a failure on our side the browser sends the SAME photos again. What those photos already reserved is
// remembered for 15 minutes (keyed by a hash of the photos, never the photos), so the retry doesn't pay twice.
// At most 3 free retries per set of photos; after that it counts like a new check.
const PAID_SECONDS = 15 * 60, FREE_RETRIES = 3;
const paidMemory = new Map<string, { units: number; retries: number; expires: number }>();
const paidKey = (photoHash: string) => key(`paid:${photoHash.replace(/[^a-f0-9]/g, "").slice(0, 64)}`);
/** Units these exact photos already reserved (0 = none, or out of free retries). Counts one retry when non-zero. */
export async function priorReservation(photoHash: string): Promise<number> {
  const redis = getRedis(), k = paidKey(photoHash);
  if (redis) {
    try {
      return await redis.eval<[number], number>("local u=tonumber(redis.call('HGET',KEYS[1],'units') or '0') if u==0 then return 0 end local r=redis.call('HINCRBY',KEYS[1],'retries',1) if r>tonumber(ARGV[1]) then return 0 end return u", [k], [FREE_RETRIES]);
    } catch { return 0; }
  }
  const now = Date.now(), hit = paidMemory.get(k);
  if (!hit || hit.expires <= now) { paidMemory.delete(k); return 0; }
  hit.retries++;
  return hit.retries > FREE_RETRIES ? 0 : hit.units;
}
/** Remember the most these photos have reserved so far. A failure here only means a retry pays again. */
export async function recordReservation(photoHash: string, units: number): Promise<void> {
  const redis = getRedis(), k = paidKey(photoHash);
  if (redis) {
    try { await redis.eval<[number, number], number>("local u=tonumber(redis.call('HGET',KEYS[1],'units') or '0') if tonumber(ARGV[1])>u then redis.call('HSET',KEYS[1],'units',ARGV[1]) end redis.call('EXPIRE',KEYS[1],tonumber(ARGV[2])) return 1", [k], [units, PAID_SECONDS]); } catch {}
    return;
  }
  const hit = paidMemory.get(k);
  paidMemory.set(k, { units: Math.max(units, hit?.units ?? 0), retries: hit?.retries ?? 0, expires: Date.now() + PAID_SECONDS * 1000 });
}
/** A check that finished is not retried: the same id and photos again count as a new check. */
export async function releaseReservation(photoHash: string): Promise<void> {
  const redis = getRedis(), k = paidKey(photoHash);
  if (redis) { try { await redis.del(k); } catch {} return; }
  paidMemory.delete(k);
}
export function clearPaidForTests() { paidMemory.clear(); }

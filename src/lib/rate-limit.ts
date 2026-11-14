import { getRedis, key } from "@/lib/redis";

const memory = new Map<string, { count: number; expires: number }>();
const dailyMemory = new Map<string, { count: number; expires: number }>();
export type LimitResult = { allowed: true; count: number } | { allowed: false; message: string; count: number };
export const bottleCheckUnits = (pills: number) => Math.max(1, Math.ceil(pills / 5));
const hourMessage = "You have reached the hourly limit. Please try again later.";
const dayMessage = "The checking service has reached today's limit. Please try again tomorrow.";

// Both counters are checked AND incremented in one transaction, including concurrent weighted reservations.
// With KEYS[3] (a check's shared reservation, phase 11g), ARGV[3] is the check's total: only what nobody in that check
// has paid for yet is charged, and the check's total is raised in the same transaction.
const RESERVE = `
local h = tonumber(redis.call('GET', KEYS[1]) or '0')
local d = tonumber(redis.call('GET', KEYS[2]) or '0')
local n = tonumber(ARGV[1])
if KEYS[3] then
  redis.call('EXPIRE', KEYS[3], tonumber(ARGV[4]))
  n = tonumber(ARGV[3]) - tonumber(redis.call('HGET', KEYS[3], 'units') or '0')
  if n <= 0 then return {1,h,0} end
end
if h+n > 30 then return {0,h,1} end
if d+n > tonumber(ARGV[2]) then return {0,h,2} end
h = redis.call('INCRBY', KEYS[1], n)
d = redis.call('INCRBY', KEYS[2], n)
redis.call('EXPIRE', KEYS[1], 3600)
redis.call('EXPIRE', KEYS[2], 172800)
if KEYS[3] then redis.call('HSET', KEYS[3], 'units', tonumber(ARGV[3])) end
return {1,h,0}
`;
/**
 * Reserve check units for this IP. With `check` (phase 11g: one check's id + photos), `units` is that check's total so
 * far, and only units no request of that check has paid for yet are charged, atomically with the limits.
 */
export async function consumeCheckLimit(ip: string, units = 1, check?: string): Promise<LimitResult> {
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
      const [allowed, count, reason] = check
        ? await redis.eval<[number, number, number, number], [number, number, number]>(RESERVE, [hourKey, dayKey, paidKey(check)], [units, dayCap, units, PAID_SECONDS])
        : await redis.eval<[number, number], [number, number, number]>(RESERVE, [hourKey, dayKey], [units, dayCap]);
      return allowed === 1 ? { allowed: true, count } : { allowed: false, count, message: reason === 1 ? hourMessage : dayMessage };
    } catch {
      // A local fallback here would bypass the shared cap across server instances.
      return { allowed: false, count: 0, message: "We couldn't reserve a check right now. Please try again shortly." };
    }
  }
  for (const map of [memory, dailyMemory]) for (const [k, v] of map) if (v.expires <= now) map.delete(k);
  const h = memory.get(hourKey)?.count ?? 0, d = dailyMemory.get(dayKey)?.count ?? 0;
  // No await between checking and incrementing: atomic within this local server instance.
  const shared = check ? paidEntry(paidKey(check)) : undefined, n = shared ? units - shared.units : units;
  if (n <= 0) return { allowed: true, count: h };
  if (h + n > 30) return { allowed: false, count: h, message: hourMessage };
  if (d + n > dayCap) return { allowed: false, count: h, message: dayMessage };
  memory.set(hourKey, { count: h + n, expires: (hour + 1) * 3_600_000 });
  dailyMemory.set(dayKey, { count: d + n, expires: now + 172_800_000 });
  if (shared) shared.units = units;
  return { allowed: true, count: h + n };
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

// Phase 11g: after a failure on our side the browser resends the SAME check (same id, same photos). What that check
// already reserved is shared by all its requests for 15 minutes (keyed by a hash, never the photos), so a retry, even one
// overlapping the still-running original, never pays for the same units twice. Every step is atomic per check.
// One check gets 1 + 3 requests on shared quota; after that each request pays on its own.
const PAID_SECONDS = 15 * 60, SHARED_VISITS = 4;
const paidMemory = new Map<string, { units: number; visits: number; expires: number }>();
const paidKey = (photoHash: string) => key(`paid:${photoHash.replace(/[^a-f0-9]/g, "").slice(0, 64)}`);
const paidEntry = (k: string) => {
  const now = Date.now(), hit = paidMemory.get(k);
  if (hit && hit.expires > now) return hit;
  const fresh = { units: 0, visits: 0, expires: now + PAID_SECONDS * 1000 };
  paidMemory.set(k, fresh); return fresh;
};
/** Counts this request against the check. true = it shares the check's quota (the first request and up to 3 retries). */
export async function joinCheck(photoHash: string): Promise<boolean> {
  const redis = getRedis(), k = paidKey(photoHash);
  if (redis) {
    try { return await redis.eval<[number], number>("local v=redis.call('HINCRBY',KEYS[1],'visits',1) redis.call('EXPIRE',KEYS[1],ARGV[1]) return v", [k], [PAID_SECONDS]) <= SHARED_VISITS; }
    catch { return false; }
  }
  return ++paidEntry(k).visits <= SHARED_VISITS;
}
/** Forget a check's reservation (diagnostics only). */
export async function releaseReservation(photoHash: string): Promise<void> {
  const redis = getRedis(), k = paidKey(photoHash);
  if (redis) { try { await redis.del(k); } catch {} return; }
  paidMemory.delete(k);
}
export function clearPaidForTests() { paidMemory.clear(); }

// Phase 11g: browser failure notes are for diagnosis only; a few a minute per IP is plenty, the rest aren't logged.
const NOTES_PER_MINUTE = 10;
const noteMemory = new Map<string, { count: number; expires: number }>();
export async function allowFailureNote(ip: string): Promise<boolean> {
  const now = Date.now(), k = key(`note:${ip.replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, 100)}:${Math.floor(now / 60_000)}`);
  const redis = getRedis();
  if (redis) {
    try { return await redis.eval<[], number>("local n=redis.call('INCR', KEYS[1]); redis.call('EXPIRE', KEYS[1],120); return n", [k], []) <= NOTES_PER_MINUTE; }
    catch { return false; }
  }
  for (const [name, v] of noteMemory) if (v.expires <= now) noteMemory.delete(name);
  const count = (noteMemory.get(k)?.count ?? 0) + 1;
  noteMemory.set(k, { count, expires: now + 120_000 });
  return count <= NOTES_PER_MINUTE;
}
export function clearNotesForTests() { noteMemory.clear(); }
/** Units this IP used this hour in the in-memory fallback (tests only). */
export function hourlyUsedForTests(ip: string) { return memory.get(key(`rate:${ip}:${Math.floor(Date.now() / 3_600_000)}`))?.count ?? 0; }

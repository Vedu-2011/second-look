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
  if (!Number.isInteger(units) || units < 1 || units > 4) throw new Error("Invalid check reservation");
  const now = Date.now(), hour = Math.floor(now / 3_600_000), daily = new Date(now).toISOString().slice(0, 10);
  const safeIp = ip.replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, 100) || "unknown";
  const cap = Number(process.env.DAILY_CHECK_CAP || 500);
  const dayCap = Number.isFinite(cap) && cap >= 0 ? Math.floor(cap) : 500;
  const hourKey = key(`rate:${safeIp}:${hour}`), dayKey = key(`daily:${daily}`);
  const redis = getRedis();
  if (redis) {
    try {
      const [allowed, count, reason] = await redis.eval<[number, number, number]>(RESERVE, [hourKey, dayKey], [units, dayCap]);
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
export function clearRateLimitForTests() { memory.clear(); dailyMemory.clear(); }

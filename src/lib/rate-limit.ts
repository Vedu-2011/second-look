import { getRedis, key } from "@/lib/redis";

const memory = new Map<string, { count: number; expires: number }>();
const dailyMemory = new Map<string, { count: number; expires: number }>();

export type LimitResult = { allowed: true; count: number } | { allowed: false; message: string; count: number };

export async function consumeCheckLimit(ip: string): Promise<LimitResult> {
  const now = Date.now();
  const hour = Math.floor(now / 3_600_000);
  const daily = new Date(now).toISOString().slice(0, 10);
  const safeIp = ip.replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, 100) || "unknown";
  const redis = getRedis();
  if (redis) {
    try {
      const hourKey = key(`rate:${safeIp}:${hour}`);
      const dayKey = key(`daily:${daily}`);
      const hourCount = await redis.incr(hourKey);
      if (hourCount === 1) await redis.expire(hourKey, 3600);
      if (hourCount > 30) return { allowed: false, count: hourCount, message: "You have reached the hourly limit. Please try again later." };
      const dayCount = await redis.incr(dayKey);
      if (dayCount === 1) await redis.expire(dayKey, 172800);
      if (dayCount > Number(process.env.DAILY_CHECK_CAP || 500)) return { allowed: false, count: dayCount, message: "The checking service has reached today's limit. Please try again tomorrow." };
      return { allowed: true, count: hourCount };
    } catch {
      // Continue with the local fallback so a temporary Redis outage is not a blank screen.
    }
  }
  const current = memory.get(safeIp);
  if (!current || current.expires <= now) memory.set(safeIp, { count: 1, expires: now + 3_600_000 });
  else current.count++;
  const count = memory.get(safeIp)!.count;
  if (count > 30) return { allowed: false, count, message: "You have reached the hourly limit. Please try again later." };
  const dailyCurrent = dailyMemory.get(daily);
  if (!dailyCurrent || dailyCurrent.expires <= now) dailyMemory.set(daily, { count: 1, expires: now + 172_800_000 });
  else dailyCurrent.count++;
  const dailyCount = dailyMemory.get(daily)!.count;
  return dailyCount > Number(process.env.DAILY_CHECK_CAP || 500)
    ? { allowed: false, count: dailyCount, message: "The checking service has reached today's limit. Please try again tomorrow." }
    : { allowed: true, count };
}

export function clearRateLimitForTests() { memory.clear(); dailyMemory.clear(); }

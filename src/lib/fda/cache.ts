// Two-level cache for FDA lookups: a small in-memory map (per server instance, also the fallback when Redis is
// down or not set up) in front of Upstash Redis. Entries live 24 h. Keys are key("fda:" + url).
import { getRedis, key } from "@/lib/redis";

export const FDA_TTL_SECONDS = 60 * 60 * 24;
const MEMORY_MAX = 300;

type Entry = { value: unknown; expires: number };
const memory = new Map<string, Entry>();
const pending = new Map<string, Promise<unknown>>();

export type CacheStats = { memoryHits: number; redisHits: number; misses: number };
export const cacheStats: CacheStats = { memoryHits: 0, redisHits: 0, misses: 0 };

export function fdaCacheKey(url: string) {
  return key(`fda:${url}`);
}

function remember(k: string, value: unknown) {
  if (memory.size >= MEMORY_MAX) memory.delete(memory.keys().next().value as string);
  memory.set(k, { value, expires: Date.now() + FDA_TTL_SECONDS * 1000 });
}

export function clearMemoryCache() {
  memory.clear();
  cacheStats.memoryHits = cacheStats.redisHits = cacheStats.misses = 0;
}

/**
 * Returns the cached value for `url`, or runs `load` and caches what it returns.
 * Cache the SLIM result (not the raw API response) so big drug lists stay well under Upstash's 1 MB value limit.
 */
export async function cached<T>(url: string, load: () => Promise<T>, { useRedis = true } = {}): Promise<T> {
  const k = fdaCacheKey(url);
  const hit = memory.get(k);
  if (hit && hit.expires > Date.now()) {
    cacheStats.memoryHits++;
    return hit.value as T;
  }
  // Coalesce the Redis miss AND the network work, including simultaneous NDC/rxcui lookups across pills.
  const running = pending.get(k);
  if (running) return running as Promise<T>;
  const task = loadCached(k, load, useRedis);
  pending.set(k, task);
  try { return await task; }
  finally { if (pending.get(k) === task) pending.delete(k); }
}

async function loadCached<T>(k: string, load: () => Promise<T>, useRedis: boolean): Promise<T> {
  const redis = useRedis ? getRedis() : null;
  if (redis) {
    try {
      const v = await redis.get<T>(k);
      if (v !== null && v !== undefined) {
        cacheStats.redisHits++;
        remember(k, v);
        return v;
      }
    } catch {
      // Redis down: carry on with memory only.
    }
  }

  cacheStats.misses++;
  const value = await load();
  remember(k, value);
  if (redis) {
    try {
      await redis.set(k, value, { ex: FDA_TTL_SECONDS });
    } catch {
      // Not fatal: we still have it in memory.
    }
  }
  return value;
}

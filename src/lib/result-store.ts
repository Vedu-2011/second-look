import { getRedis, key } from "@/lib/redis";
import type { CheckResult } from "@/lib/check-service";
import type { Explanation } from "@/lib/ai/guard";

export type StoredResult = { result: CheckResult; explanation: Explanation; createdAt: string };
const memory = new Map<string, StoredResult>();
const RESULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function pruneExpired(now = Date.now()) {
  for (const [id, value] of memory) if (now - Date.parse(value.createdAt) >= RESULT_TTL_MS) memory.delete(id);
}

export async function saveResult(value: Omit<StoredResult, "createdAt">) {
  const id = crypto.randomUUID();
  const stored = { ...value, createdAt: new Date().toISOString() };
  pruneExpired();
  memory.set(id, stored);
  const redis = getRedis();
  if (redis) {
    try { await redis.set(key(`result:${id}`), stored, { ex: 7 * 24 * 60 * 60 }); } catch { /* local fallback remains usable */ }
  }
  return id;
}

export async function getResult(id: string) {
  pruneExpired();
  const local = memory.get(id);
  if (local) return local;
  const redis = getRedis();
  if (!redis) return null;
  try { return await redis.get<StoredResult>(key(`result:${id}`)); } catch { return null; }
}

export function clearResultMemoryForTests() { memory.clear(); }

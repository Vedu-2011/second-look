import { getRedis, key } from "./redis";
import type { CheckResult } from "./check-service";
const memory = new Map<string, { result: CheckResult; expires: number }>();
const ttl = 600;
function prune() {
  for (const [id, v] of memory) if (v.expires <= Date.now()) memory.delete(id);
  while (memory.size > 100) memory.delete(memory.keys().next().value!);
}
export async function saveFlip(result: CheckResult) {
  const id = crypto.randomUUID();
  prune();
  memory.set(id, { result, expires: Date.now() + ttl * 1000 });
  const redis = getRedis();
  if (redis)
    try {
      await redis.set(key(`flip:${id}`), result, { ex: ttl });
    } catch {
      /* bounded local fallback */
    }
  return id;
}
export async function getFlip(id: string): Promise<CheckResult | null> {
  prune();
  const local = memory.get(id);
  if (local) return local.result;
  const redis = getRedis();
  if (!redis) return null;
  try {
    return await redis.get<CheckResult>(key(`flip:${id}`));
  } catch {
    return null;
  }
}

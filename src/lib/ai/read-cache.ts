// Phase 11g: a retry of the SAME request must not pay twice. Readings (never photos) are kept for 15 minutes, keyed by
// the request's scope (a hash of every photo it sent, plus the first check's id), the reader, model and image bytes.
// Scoping by request means only an exact resend reuses readings: a follow-up photo always gets fresh reads. The n-th
// read of one image within a request maps to the n-th cached reading, so a deliberate second read of the same crop is
// still a real second read the first time round.
import { createHash } from "node:crypto";
import { getRedis, key } from "@/lib/redis";
import type { ImageInput, ReadOptions } from "@/lib/ai/client";

export const READ_CACHE_SECONDS = 15 * 60;
type Store = { get(k: string): Promise<unknown>; set(k: string, value: unknown): Promise<void> };

const memory = new Map<string, { value: unknown; expires: number }>();
const memoryStore: Store = {
  async get(k) { const hit = memory.get(k); if (!hit || hit.expires <= Date.now()) { memory.delete(k); return null; } return structuredClone(hit.value); },
  async set(k, value) { memory.set(k, { value: structuredClone(value), expires: Date.now() + READ_CACHE_SECONDS * 1000 }); },
};
export function defaultReadStore(): Store {
  const redis = getRedis();
  return redis ? { get: (k) => redis.get(k), set: async (k, value) => { await redis.set(k, value, { ex: READ_CACHE_SECONDS }); } } : memoryStore;
}
export const clearReadCacheForTests = () => memory.clear();

/** One per request. Wrap each reader: cache("pill", readPill). A cache error never fails the check: it just reads. */
export function requestReadCache(scope: string, store: Store = defaultReadStore()) {
  const seen = new Map<string, number>();
  return function cached<T>(kind: string, reader: (image: ImageInput, options: ReadOptions) => Promise<T>) {
    return async (image: ImageInput, options: ReadOptions = {}): Promise<T> => {
      const base = createHash("sha256").update(`${scope}\n${kind}\n${options.model ?? ""}\n${image.mediaType}\n`).update(image.base64).digest("hex");
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      const k = key(`read:${base}:${n}`);
      const hit = await store.get(k).catch(() => null);
      if (hit !== null && hit !== undefined) return hit as T;
      const value = await reader(image, options);
      await store.set(k, value).catch(() => {});
      return value;
    };
  };
}

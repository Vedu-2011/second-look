// Upstash Redis from the Vercel Marketplace (env prefix KV_). Returns null when it isn't configured,
// so callers can say so plainly instead of crashing.
//
// This database is shared with our earlier LineLess app (the Upstash free plan allows only one), so every
// Second Look key goes through key() and lives under "sl:".
import { Redis } from "@upstash/redis";

export const KEY_PREFIX = "sl:";

export function key(name: string) {
  return `${KEY_PREFIX}${name}`;
}

let client: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

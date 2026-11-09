// Upstash Redis from the Vercel Marketplace (env prefix KV_). Returns null when it isn't configured,
// so callers can say so plainly instead of crashing.
import { Redis } from "@upstash/redis";

let client: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

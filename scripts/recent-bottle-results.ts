// Read-only diagnosis: the newest stored bottle results (our key prefix only; nothing is written or deleted).
// Usage: npm run diag:bottles [-- <how many>]
import { writeFile } from 'node:fs/promises';
import { getRedis, key } from '@/lib/redis';
(async () => {
  const redis = getRedis();
  if (!redis) { console.error('Redis is not configured here.'); process.exitCode = 1; return; }
  const keys: string[] = []; let cursor: string | number = 0;
  do { const [next, batch]: [string | number, string[]] = await redis.scan(cursor, { match: key('bottle-result:*'), count: 200 }); cursor = next; keys.push(...batch); } while (String(cursor) !== '0');
  const rows = (await Promise.all(keys.map(async k => ({ k, v: await redis.get<{ result: { checkedAt: string } }>(k) })))).filter(r => r.v);
  rows.sort((a, b) => b.v!.result.checkedAt.localeCompare(a.v!.result.checkedAt));
  const n = Number(process.argv[2] ?? 5);
  for (const r of rows.slice(0, n)) console.log(r.v!.result.checkedAt, r.k.split(':').pop());
  await writeFile('test-images/bottle/generated/recent-bottle-results.json', JSON.stringify(rows.slice(0, n).map(r => ({ id: r.k.split(':').pop(), ...r.v })), null, 2) + '\n');
})();

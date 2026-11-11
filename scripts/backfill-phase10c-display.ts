// One-time provenance for the explicitly reviewed saved demo. No AI, verdict recomputation or expiry extension.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { planFollowUp } from '@/lib/bottle/match-positions';
import type { BottleResult } from '@/lib/bottle/types';
import { getRedis, key } from '@/lib/redis';
import type { StoredBottleResult } from '@/lib/result-store';
async function main() {
  const before = JSON.parse(await readFile('docs/screenshots/phase-10b/real-before.json', 'utf8')) as BottleResult;
  const after = JSON.parse(await readFile('docs/screenshots/phase-10b/real-after.json', 'utf8')) as BottleResult;
  const plan = planFollowUp(before, { image: after.image, boxes: after.pills.map(p => p.box), features: after.pills.map(p => p.features!), clumps: after.clumps ?? [] });
  assert.equal(plan.mode, 'reread'); if (plan.mode !== 'reread') throw new Error('No trusted recorded correspondence');
  const patch: Record<number, string> = {};
  const display = structuredClone(after);
  display.pills.forEach((p, i) => {
    if (!p.carried) return;
    const prior = plan.prior.get(i); assert(prior, 'Missing recorded correspondence');
    assert.deepEqual(p.result.pill, prior.result.pill, 'The history must be the actual recorded first reading');
    p.previousVerdict = prior.result.verdict; patch[p.number] = prior.result.verdict;
  });
  await writeFile('docs/screenshots/phase-10c/real-after-display.json', JSON.stringify(display, null, 2) + '\n');
  const audit = { scope: 'Display provenance only; all current verdicts/decisions/readings unchanged.', sourceBeforeCheckedAt: before.checkedAt, sourceAfterCheckedAt: after.checkedAt, beforeSha256: createHash('sha256').update(JSON.stringify(before)).digest('hex'), afterSha256: createHash('sha256').update(JSON.stringify(after)).digest('hex'), previousVerdicts: patch, applied: false };
  if (process.argv.includes('--apply')) {
    const redis = getRedis(); if (!redis) throw new Error('Redis not configured');
    const id = '1537e0b0-9286-467d-84d2-9f2ff8425ff6';
    const k = key('bottle-result:' + id);
    const stored = await redis.get<StoredBottleResult>(k); assert(stored, 'Saved demo expired');
    assert.equal(stored.result.checkedAt, after.checkedAt); assert.equal(stored.result.label.ndc, after.label.ndc);
    assert.equal(stored.result.pills.length, after.pills.length);
    const updated = structuredClone(stored);
    updated.result.pills.forEach((p, i) => {
      assert.deepEqual(p.box, after.pills[i].box); assert.deepEqual(p.result.pill, after.pills[i].result.pill);
      assert.equal(p.result.verdict, after.pills[i].result.verdict);
      if (p.carried) p.previousVerdict = display.pills[i].previousVerdict;
    });
    const stripped = structuredClone(updated), old = structuredClone(stored);
    for (const value of [stripped, old]) value.result.pills.forEach(p => { delete p.previousVerdict; });
    assert.deepEqual(stripped, old, 'Only presentation metadata may change');
    // Compare the full original wire value and keep its remaining TTL. No photos or tokens introduced.
    const changed = await redis.eval(`if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL') return 1`, [k], [JSON.stringify(stored), JSON.stringify(updated)]);
    assert.equal(changed, 1, 'Record changed concurrently; no blind overwrite');
    const check = await redis.get<StoredBottleResult>(k); assert.deepEqual(check, updated);
    audit.applied = true;
  }
  await writeFile('docs/screenshots/phase-10c/display-provenance.json', JSON.stringify(audit, null, 2) + '\n');
  console.log(JSON.stringify({ previousVerdicts: patch, applied: audit.applied }));
}
main().catch(e => { console.error(e instanceof Error ? e.message : 'Provenance backfill failed'); process.exitCode = 1; });

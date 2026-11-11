// Phase 10b manual verification; PAID-API LOCK and a durable $0.50 cap shared with sample/flip scripts.
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { runBottleCheck, runBottleFollowUp } from '@/lib/bottle/check-bottle';
import type { BottleResult } from '@/lib/bottle/types';
import { phase10bReaders } from './lib/phase10b-readers';
const dir = 'test-images/bottle/generated/';
async function main() {
  const budget = phase10bReaders();
  const labelBytes = await sharp(await readFile('test-images/real/bottle/label.jpg')).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  const labelImage = { mediaType: 'image/jpeg' as const, base64: labelBytes.toString('base64') };
  const label = await budget.readLabel(labelImage);
  const deps = { label, readPill: budget.readPill };
  const summary = (result: BottleResult) => ({ decision: result.decision, followUp: result.followUp, pills: result.pills.map(p => ({ number: p.number, verdict: p.result.verdict, imprint: p.result.pill.imprintSides, confidence: p.result.pill.imprintConfidence, identifiedAs: p.result.identifiedAs?.title, reread: p.reread })), elapsedMs: result.elapsedMs });
  try {
    const before = await runBottleCheck(labelImage, await readFile('test-images/real/bottle/pills.jpg'), async () => {}, () => {}, deps);
    if (!before) throw new Error('Bottle retake required');
    await writeFile(dir + 'phase10b-before.json', JSON.stringify(before, null, 2));
    console.log('BEFORE', JSON.stringify(summary(before), null, 2));
    const after = await runBottleFollowUp(before, await readFile('test-images/real/bottle/pills-flipped.jpg'), async () => {}, () => {}, deps);
    if (!after) throw new Error('Follow-up retake required');
    await writeFile(dir + 'phase10b-after.json', JSON.stringify(after, null, 2));
    console.log('AFTER', JSON.stringify(summary(after), null, 2));
    if (process.argv.includes('--extra')) {
      const extra = await runBottleCheck(labelImage, await readFile('test-images/real/extra/bottle-93-upside-down.jpg'), async () => {}, () => {}, deps);
      if (!extra) throw new Error('Upside-down bottle retake required');
      await writeFile(dir + 'phase10b-extra.json', JSON.stringify(extra, null, 2));
      console.log('UPSIDE DOWN', JSON.stringify(summary(extra), null, 2));
    }
  } finally { budget.report(); }
}
main().catch(e => { console.error(e instanceof Error ? e.message : 'Verification failed'); process.exitCode = 1; });

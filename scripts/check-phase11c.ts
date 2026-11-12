// Phase 11c/11d paid smoke (hold PAID-API LOCK; durable cap $0.40 for 11c, $0.10 for 11d). Cache-only unless --live.
// `--phase 11d` writes phase11d-* files and re-uses every earlier finished reading read-only.
// (a) the real metformin bottle must stay RED with pill "93" flagged. (b) a real pile: what the group reader saw.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { runBottleCheck } from '@/lib/bottle/check-bottle';
import { phase10bReaders } from './lib/phase10b-readers';
const generated = 'test-images/bottle/generated';
async function main() {
  const live = process.argv.includes('--live');
  const phase = process.argv.includes('--phase') ? process.argv[process.argv.indexOf('--phase') + 1] : '11c';
  const older = ['phase10b', 'phase11', ...(phase === '11c' ? [] : ['phase11c'])].map(n => `${generated}/${n}-usage.json`);
  const budget = phase10bReaders({ live, file: `${generated}/phase${phase}-usage.json`, budgetUsd: phase === '11c' ? 0.4 : 0.1, scope: `phase${phase}`, cacheFiles: older });
  const failures: string[] = [];
  const wrap = <A extends unknown[], R>(f: (...a: A) => Promise<R>) => async (...a: A) => { try { return await f(...a); } catch (e) { failures.push(e instanceof Error ? e.message.slice(0, 120) : 'read failed'); throw e; } };
  const deps = { readPill: wrap(budget.readPill), readPillGroup: wrap(budget.readPillGroup) };
  const labelBytes = await sharp(await readFile('test-images/real/bottle/label.jpg')).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  const labelImage = { mediaType: 'image/jpeg' as const, base64: labelBytes.toString('base64') };
  const units: Record<string, number[]> = { metformin: [], pile: [] };
  const metformin = await runBottleCheck(labelImage, await readFile('test-images/real/bottle/pills.jpg'), async n => { units.metformin.push(n); }, () => {}, { ...deps, label: await budget.readLabel(labelImage) });
  // No label photo exists for the user-test pour; same declared label as the phase 11 run.
  const pile = await runBottleCheck({ mediaType: 'image/jpeg', base64: '' }, await readFile('test-images/real/extra/user-test-ibuprofen-tylenol.jpg'), async n => { units.pile.push(n); }, () => {},
    { ...deps, checkAnyway: true, label: { ndc: '69452-212', drugName: 'Ibuprofen', strength: '200 mg', form: 'capsule' } as never });
  const brief = (r: typeof metformin) => r && ({ decision: r.decision, clumps: r.clumps, pills: r.pills.map(p => ({ number: p.number, fromPile: p.fromPile ?? false, imprint: p.result.pill.imprintSides, reason: p.result.reasons[0], doubleRead: p.doubleRead, confidence: p.result.pill.imprintConfidence, colors: p.result.pill.colors, verdict: p.result.verdict, odd: p.odd, shapeNote: p.shapeNote })) });
  const red = metformin?.decision.verdict === 'MISMATCH' && metformin.pills.some(p => p.result.verdict === 'MISMATCH' && p.result.pill.imprintSides.some(s => s.includes('93')));
  const report = { mode: live ? `live, $${phase === '11c' ? '0.40' : '0.10'} cap` : 'cache only', misses: budget.misses(), failures, units, metforminRedWith93: red, metformin: brief(metformin), pile: brief(pile), usage: budget.summary() };
  await mkdir(generated, { recursive: true });
  if (metformin) await writeFile(`${generated}/phase${phase}-metformin.json`, JSON.stringify(metformin, null, 2) + '\n');
  if (pile) await writeFile(`${generated}/phase${phase}-pile.json`, JSON.stringify(pile, null, 2) + '\n');
  await writeFile(`${generated}/phase${phase}-report.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2)); budget.report();
  if (live && (!red || failures.length)) process.exitCode = 1;
}
main().catch(e => { console.error(e instanceof Error ? e.message : 'Smoke failed'); process.exitCode = 1; });

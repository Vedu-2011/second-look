// Explicitly budgeted real-photo verification. Cache survives scripts/restarts; no secrets or photos in the ledger.
import type Anthropic from '@anthropic-ai/sdk';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { DEFAULT_VISION_MODEL, getAnthropic, type ImageInput, type ReadOptions } from '@/lib/ai/client';
import { readLabel, readPill, readPillGroup } from '@/lib/ai/readers';
import { readPillGroupPrompt, readPillGroupTool } from '@/lib/ai/prompts/read-pill-group';
import type { AiPillGroupReading } from '@/lib/ai/schemas';
import { readLabelPrompt, readLabelTool } from '@/lib/ai/prompts/read-label';
import { readPillPrompt, readPillTool } from '@/lib/ai/prompts/read-pill';
import { templateExplanation } from '@/lib/ai/guard';
import type { LabelReading, PillReading } from '@/lib/verdict-engine';
import { SmokeLedger, smokeBound, smokeKey } from './bottle-smoke-cache';

// Phase 11c only APPENDED the group schema to schemas.ts; single-pill cleaning is unchanged. When the file still starts
// with the 71225f5 version, key on that version so earlier real readings stay valid (no re-paying for identical reads).
function cleaningSource() {
  const now = readFileSync('src/lib/ai/schemas.ts', 'utf8');
  try { const before = execFileSync('git', ['show', '71225f5:src/lib/ai/schemas.ts'], { encoding: 'utf8' }); return now.startsWith(before) ? before : now; } catch { return now; }
}
type Kind = 'label' | 'pill' | 'group';
export function phase10bReaders(config: { file?: string; budgetUsd?: number; live?: boolean; scope?: string; cacheFiles?: string[] } = {}) {
  const live = config.live ?? process.env.PHASE10B_LIVE === '1';
  const ledger = new SmokeLedger(config.file ?? 'test-images/bottle/generated/phase10b-usage.json', config.budgetUsd ?? 0.5);
  const older = (config.cacheFiles ?? []).filter(f => existsSync(f)).map(f => new SmokeLedger(f, 1));
  const cleaning = [readFileSync('src/lib/ai/clean-pill.ts', 'utf8'), cleaningSource()];
  const pending = new Map<string, Promise<LabelReading | PillReading | AiPillGroupReading>>();
  const misses: string[] = [];
  let cacheHits = 0;
  async function read(image: ImageInput, kind: Kind, options: ReadOptions = {}) {
    const prompt = kind === 'label' ? readLabelPrompt : kind === 'group' ? readPillGroupPrompt : readPillPrompt;
    const tool = kind === 'label' ? readLabelTool : kind === 'group' ? readPillGroupTool : readPillTool;
    const maxTokens = kind === 'group' ? 4000 : 1200;
    const key = smokeKey(Buffer.from(image.base64, 'base64'), DEFAULT_VISION_MODEL, JSON.stringify({ prompt, tool, cleaning, maxTokens, mediaType: image.mediaType }));
    if (pending.has(key)) { cacheHits++; return pending.get(key)!; }
    const existing = ledger.cached(key) ?? older.map(l => l.done(key)).find(Boolean);
    if (existing) { cacheHits++; return existing; }
    if (!live) misses.push(kind);
    const task = (async () => {
      if (!live) throw new Error('No cached phase10b reading. Set PHASE10B_LIVE=1 only while holding PAID-API LOCK.');
      const count = await getAnthropic(0).messages.countTokens({ model: DEFAULT_VISION_MODEL, system: prompt, tools: [tool as unknown as Anthropic.Tool], tool_choice: { type: 'auto' }, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } }, { type: 'text', text: 'Use the tool and return only the structured reading.' }] }] });
      ledger.reserve(key, smokeBound(count.input_tokens, maxTokens));
      let attempts = 0;
      try {
        const value = await (kind === 'label' ? readLabel : kind === 'group' ? readPillGroup : readPill)(image, { model: DEFAULT_VISION_MODEL, maxRetries: 0, beforeAttempt: async () => { await options.beforeAttempt?.(); if (++attempts > 2) throw new Error('Attempt cap'); }, onUsage: (model, input, output) => { ledger.usage(key, model, input, output); options.onUsage?.(model, input, output); } });
        ledger.finish(key, value); return value;
      } catch (error) { ledger.fail(key); throw error; }
    })();
    pending.set(key, task); return task;
  }
  return {
    readLabel: (image: ImageInput) => read(image, 'label') as Promise<LabelReading>,
    readPill: (image: ImageInput, options?: ReadOptions) => read(image, 'pill', options) as Promise<PillReading>,
    readPillGroup: (image: ImageInput, options?: ReadOptions) => read(image, 'group', options) as Promise<AiPillGroupReading>,
    misses: () => [...misses],
    explain: async (result: Parameters<typeof templateExplanation>[0]) => templateExplanation(result),
    summary: () => ledger.summary(),
    report: () => console.log(JSON.stringify({ [config.scope ?? 'phase10b']: ledger.summary(), cacheHits, explanation: 'deterministic template; no text-model spend' })),
  };
}

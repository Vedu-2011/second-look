// Explicitly budgeted real-photo verification. Cache survives scripts/restarts; no secrets or photos in the ledger.
import type Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { DEFAULT_VISION_MODEL, getAnthropic, type ImageInput, type ReadOptions } from '@/lib/ai/client';
import { readLabel, readPill } from '@/lib/ai/readers';
import { readLabelPrompt, readLabelTool } from '@/lib/ai/prompts/read-label';
import { readPillPrompt, readPillTool } from '@/lib/ai/prompts/read-pill';
import { templateExplanation } from '@/lib/ai/guard';
import type { LabelReading, PillReading } from '@/lib/verdict-engine';
import { SmokeLedger, smokeBound, smokeKey } from './bottle-smoke-cache';

export function phase10bReaders(config: { file?: string; budgetUsd?: number; live?: boolean; scope?: string } = {}) {
  const live = config.live ?? process.env.PHASE10B_LIVE === '1';
  const ledger = new SmokeLedger(config.file ?? 'test-images/bottle/generated/phase10b-usage.json', config.budgetUsd ?? 0.5);
  const cleaning = ['src/lib/ai/clean-pill.ts', 'src/lib/ai/schemas.ts'].map(p => readFileSync(p, 'utf8'));
  const pending = new Map<string, Promise<LabelReading | PillReading>>();
  let cacheHits = 0;
  async function read(image: ImageInput, kind: 'label' | 'pill', options: ReadOptions = {}) {
    const prompt = kind === 'label' ? readLabelPrompt : readPillPrompt;
    const tool = kind === 'label' ? readLabelTool : readPillTool;
    const key = smokeKey(Buffer.from(image.base64, 'base64'), DEFAULT_VISION_MODEL, JSON.stringify({ prompt, tool, cleaning, maxTokens: 1200, mediaType: image.mediaType }));
    if (pending.has(key)) { cacheHits++; return pending.get(key)!; }
    const existing = ledger.cached(key);
    if (existing) { cacheHits++; return existing; }
    const task = (async () => {
      if (!live) throw new Error('No cached phase10b reading. Set PHASE10B_LIVE=1 only while holding PAID-API LOCK.');
      const count = await getAnthropic(0).messages.countTokens({ model: DEFAULT_VISION_MODEL, system: prompt, tools: [tool as unknown as Anthropic.Tool], tool_choice: { type: 'auto' }, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } }, { type: 'text', text: 'Use the tool and return only the structured reading.' }] }] });
      ledger.reserve(key, smokeBound(count.input_tokens));
      let attempts = 0;
      try {
        const value = await (kind === 'label' ? readLabel : readPill)(image, { model: DEFAULT_VISION_MODEL, maxRetries: 0, beforeAttempt: async () => { await options.beforeAttempt?.(); if (++attempts > 2) throw new Error('Attempt cap'); }, onUsage: (model, input, output) => { ledger.usage(key, model, input, output); options.onUsage?.(model, input, output); } });
        ledger.finish(key, value); return value;
      } catch (error) { ledger.fail(key); throw error; }
    })();
    pending.set(key, task); return task;
  }
  return {
    readLabel: (image: ImageInput) => read(image, 'label') as Promise<LabelReading>,
    readPill: (image: ImageInput, options?: ReadOptions) => read(image, 'pill', options) as Promise<PillReading>,
    explain: async (result: Parameters<typeof templateExplanation>[0]) => templateExplanation(result),
    summary: () => ledger.summary(),
    report: () => console.log(JSON.stringify({ [config.scope ?? 'phase10b']: ledger.summary(), cacheHits, explanation: 'deterministic template; no text-model spend' })),
  };
}

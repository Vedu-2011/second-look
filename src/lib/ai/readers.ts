import { readLabelPrompt, readLabelTool } from "@/lib/ai/prompts/read-label";
import { readPillPrompt, readPillTool } from "@/lib/ai/prompts/read-pill";
import { readPillGroupPrompt, readPillGroupTool } from "@/lib/ai/prompts/read-pill-group";
import { labelReadingSchema, pillGroupReadingSchema, pillReadingSchema, toLabelReading, toPillReading, type AiPillGroupReading } from "@/lib/ai/schemas";
import { toolRead, type ImageInput, type ReadOptions } from "@/lib/ai/client";
import { cleanPillReading } from './clean-pill';

export async function readLabel(image: ImageInput, options: ReadOptions = {}) {
  const value = await toolRead({ ...options, image, system: readLabelPrompt, tool: readLabelTool, validate: (input) => labelReadingSchema.parse(input) });
  return toLabelReading(value);
}

export async function readPill(image: ImageInput, options: ReadOptions = {}) {
  const value = await toolRead({ ...options, image, system: readPillPrompt, tool: readPillTool, validate: (input) => pillReadingSchema.parse(cleanPillReading(input)) });
  return toPillReading(value);
}

/** Bottle mode only: every pill visible in a crop of touching pills. Each entry is cleaned like a single reading. */
export async function readPillGroup(image: ImageInput, options: ReadOptions = {}): Promise<AiPillGroupReading> {
  return toolRead({ ...options, maxTokens: options.maxTokens ?? 4000, image, system: readPillGroupPrompt, tool: readPillGroupTool, validate: (input) => {
    const raw = input && typeof input === "object" ? input as Record<string, unknown> : {};
    return pillGroupReadingSchema.parse({ ...raw, pills: Array.isArray(raw.pills) ? raw.pills.map((p) => cleanPillReading(p)) : raw.pills });
  } });
}

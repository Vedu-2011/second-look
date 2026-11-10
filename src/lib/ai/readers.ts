import { readLabelPrompt, readLabelTool } from "@/lib/ai/prompts/read-label";
import { readPillPrompt, readPillTool } from "@/lib/ai/prompts/read-pill";
import { labelReadingSchema, pillReadingSchema, toLabelReading, toPillReading } from "@/lib/ai/schemas";
import { toolRead, type ImageInput } from "@/lib/ai/client";
import { cleanPillReading } from './clean-pill';

export async function readLabel(image: ImageInput) {
  const value = await toolRead({ image, system: readLabelPrompt, tool: readLabelTool, validate: (input) => labelReadingSchema.parse(input) });
  return toLabelReading(value);
}

export async function readPill(image: ImageInput) {
  const value = await toolRead({ image, system: readPillPrompt, tool: readPillTool, validate: (input) => pillReadingSchema.parse(cleanPillReading(input)) });
  return toPillReading(value);
}

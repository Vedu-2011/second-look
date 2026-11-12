import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_VISION_MODEL = "claude-sonnet-5-5";
export const DEFAULT_TEXT_MODEL = "claude-haiku-5-5";

export class AiUnavailableError extends Error {
  constructor(message = "AI reading is not configured for this deployment yet.") {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export function getAnthropic(maxRetries?: number) {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiUnavailableError();
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, ...(maxRetries === undefined ? {} : { maxRetries }) });
}

export function visionModel() {
  return process.env.VISION_MODEL || DEFAULT_VISION_MODEL;
}

export function textModel() {
  return process.env.TEXT_MODEL || DEFAULT_TEXT_MODEL;
}

export type ImageInput = { base64: string; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" };

export type UsageObserver = (model: string, inputTokens: number, outputTokens: number) => void;
let usageObserver: UsageObserver | undefined;

/** Optional process-local observer for the live smoke script; never records image data. */
export function setAiUsageObserver(observer?: UsageObserver) {
  usageObserver = observer;
}

function recordUsage(model: string, usage: Anthropic.Message["usage"], observer?: UsageObserver) {
  observer?.(model, usage.input_tokens, usage.output_tokens);
  usageObserver?.(model, usage.input_tokens, usage.output_tokens);
  // Model and token counts only; never log transcriptions, prompts or images.
  if (process.env.VERCEL_ENV === "production") {
    console.info("second-look.ai.usage", JSON.stringify({
      model,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    }));
  }
}

export type ReadOptions = {
  model?: string;
  /** Request-scoped observer; never changes another concurrent request's accounting. */
  onUsage?: UsageObserver;
  /** Smoke-only durable reservation before each billable attempt. */
  beforeAttempt?: () => Promise<void>;
  maxRetries?: number;
  /** Longer structured answers (a whole pile); single readers keep the 1200 default. */
  maxTokens?: number;
};

export async function toolRead<T>({
  image,
  system,
  tool,
  model = visionModel(),
  validate,
  onUsage,
  beforeAttempt,
  maxRetries,
  maxTokens = 1200,
}: {
  image: ImageInput;
  system: string;
  tool: { name: string; description: string; input_schema: Record<string, unknown> };
  model?: string;
  validate: (input: unknown) => T;
} & ReadOptions) {
  const client = getAnthropic(maxRetries);
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    await beforeAttempt?.();
    try {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        tools: [tool as Anthropic.Tool],
        tool_choice: { type: "auto" },
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
            { type: "text", text: "Use the tool and return only the structured reading." },
          ],
        }],
      });
      recordUsage(model, response.usage, onUsage);
      const block = response.content.find((item) => item.type === "tool_use");
      if (!block || block.type !== "tool_use") throw new Error("Claude did not return the reading tool.");
      return validate(block.input);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`The AI reading was not valid after one retry: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
}

export async function explainWithFacts(facts: Record<string, unknown>) {
  const client = getAnthropic();
  const response = await client.messages.create({
    model: textModel(),
    max_tokens: 500,
    system: "You write a short, calm explanation for a pharmacy double-check. Use only the supplied facts. Never give dosing advice or medical advice. Never introduce a drug, strength, imprint, NDC, or number absent from facts.",
    messages: [{ role: "user", content: `Return JSON with summary and pharmacyScript. Facts JSON:\n${JSON.stringify(facts)}` }],
  });
  recordUsage(textModel(), response.usage);
  return response.content.filter((item) => item.type === "text").map((item) => item.text).join("\n");
}

import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_VISION_MODEL = "claude-sonnet-5-5";
export const DEFAULT_TEXT_MODEL = "claude-haiku-5-5";

export class AiUnavailableError extends Error {
  constructor(message = "AI reading is not configured for this deployment yet.") {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiUnavailableError();
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export function visionModel() {
  return process.env.VISION_MODEL || DEFAULT_VISION_MODEL;
}

export function textModel() {
  return process.env.TEXT_MODEL || DEFAULT_TEXT_MODEL;
}

export type ImageInput = { base64: string; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" };

type UsageObserver = (model: string, inputTokens: number, outputTokens: number) => void;
let usageObserver: UsageObserver | undefined;

/** Optional process-local observer for the live smoke script; never records image data. */
export function setAiUsageObserver(observer?: UsageObserver) {
  usageObserver = observer;
}

export async function toolRead<T>({
  image,
  system,
  tool,
  model = visionModel(),
  validate,
}: {
  image: ImageInput;
  system: string;
  tool: { name: string; description: string; input_schema: Record<string, unknown> };
  model?: string;
  validate: (input: unknown) => T;
}) {
  const client = getAnthropic();
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 1200,
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
      usageObserver?.(model, response.usage.input_tokens, response.usage.output_tokens);
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
  usageObserver?.(textModel(), response.usage.input_tokens, response.usage.output_tokens);
  return response.content.filter((item) => item.type === "text").map((item) => item.text).join("\n");
}

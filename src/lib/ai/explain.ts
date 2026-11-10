import { explainWithFacts } from "@/lib/ai/client";
import { guardExplanation, templateExplanation, type Explanation } from "@/lib/ai/guard";
import type { EngineResult } from "@/lib/verdict-engine";

export async function explain(result: EngineResult): Promise<Explanation> {
  const fallback = templateExplanation(result);
  if (!process.env.ANTHROPIC_API_KEY) return fallback;
  try {
    const raw = await explainWithFacts({
      verdict: result.verdict,
      labelTitle: result.labelTitle,
      expected: result.expected ? { title: result.expected.title, brand: result.expected.brand } : null,
      matched: result.matchedProduct ? { title: result.matchedProduct.title, brand: result.matchedProduct.brand } : null,
      identifiedAs: result.identifiedAs ? { title: result.identifiedAs.title, brand: result.identifiedAs.brand } : null,
      features: result.features,
      reasons: result.reasons,
    });
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return fallback; }
    return guardExplanation(parsed, result);
  } catch {
    return fallback;
  }
}

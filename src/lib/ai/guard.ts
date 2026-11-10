import type { EngineResult } from "@/lib/verdict-engine";

export type Explanation = { summary: string; pharmacyScript: string };

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const drugLike = /^(?:tylenol|advil|motrin|aleve|aspirin|ibuprofen|acetaminophen|naproxen|amoxicillin|azithromycin|metformin|lisinopril|atorvastatin|prednisone|prazole|cillin|mycin|statin|pril|sartan|ol|azole|codone|caine|zepam|oxetine|vir|mab|cept)$/i;

export function templateExplanation(result: EngineResult): Explanation {
  const verdict = result.verdict;
  if (verdict === "MATCH") return { summary: "The visible pill matches the FDA record we checked for your label.", pharmacyScript: "The pill in my bottle matches the FDA record for my label." };
  if (verdict === "SAME_MEDICINE_DIFFERENT_MAKER") return { summary: "The pill looks like a different maker's version of the same medicine and strength on your label.", pharmacyScript: "My pill looks different from the label. Can you confirm it is the same medicine and strength?" };
  if (verdict === "MISMATCH") return { summary: "The pill does not match the medicine on the label. Do not take it until your pharmacy confirms it.", pharmacyScript: "The pill does not match the medicine on my label. Can you check this bottle and pill?" };
  return { summary: "We couldn't confirm this pill from the photo and FDA records. Do not take it until your pharmacy confirms it.", pharmacyScript: "I couldn't confirm the pill from the photo. Can you check this bottle and pill with me?" };
}

function factWords(result: EngineResult) {
  const values = [result.labelTitle, result.expected?.title, result.expected?.brand, result.matchedProduct?.title, result.matchedProduct?.brand, result.identifiedAs?.title, result.identifiedAs?.brand, ...result.features.flatMap((f) => [f.expected, f.found]), ...result.reasons];
  return values.filter(Boolean).map((v) => clean(String(v)).toLowerCase()).filter((v) => v.length > 1);
}

export function guardExplanation(raw: unknown, result: EngineResult): Explanation {
  const fallback = templateExplanation(result);
  if (!raw || typeof raw !== "object") return fallback;
  const candidate = raw as { summary?: unknown; pharmacyScript?: unknown };
  if (typeof candidate.summary !== "string" || typeof candidate.pharmacyScript !== "string") return fallback;
  const summary = clean(candidate.summary);
  const pharmacyScript = clean(candidate.pharmacyScript);
  if (!summary || !pharmacyScript || summary.length > 500 || pharmacyScript.length > 500) return fallback;
  const rawCombined = `${summary} ${pharmacyScript}`;
  const combined = rawCombined.toLowerCase();
  const facts = factWords(result);
  const forbidden = [/\b(?:take|taking|dose|dosage|mg|ml|tablet|capsule)\b.*\b(?:daily|twice|once|every|hours?)\b/i, /\b(?:diagnos|prescri|treat|safe|unsafe)\w*\b/i];
  if (forbidden.some((pattern) => pattern.test(combined))) return fallback;
  const numberTokens = combined.match(/\b\d+(?:\.\d+)?\b/g) ?? [];
  if (numberTokens.some((token) => !facts.some((fact) => fact.includes(token)))) return fallback;
  const namedFacts = facts.filter((fact) => /[a-z]/i.test(fact));
  const suspiciousDrugLike = rawCombined.match(/\b[A-Z][a-z]{3,}\b/g) ?? [];
  const lowercaseWords = combined.match(/\b[a-z]{4,}\b/g) ?? [];
  if (suspiciousDrugLike.some((word) => !namedFacts.some((fact) => fact.includes(word.toLowerCase())) && !["The", "This", "Your", "Same", "Do", "Can", "I", "My"].includes(word))) return fallback;
  if (lowercaseWords.some((word) => drugLike.test(word) && !namedFacts.some((fact) => fact.includes(word)))) return fallback;
  return { summary, pharmacyScript };
}

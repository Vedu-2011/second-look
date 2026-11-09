// The four verdicts and their fixed wording. Code picks the verdict (phase 1); this file only says it.

export type Verdict = "MATCH" | "SAME_MEDICINE_DIFFERENT_MAKER" | "MISMATCH" | "UNSURE";

export const VERDICTS: Verdict[] = ["MATCH", "SAME_MEDICINE_DIFFERENT_MAKER", "MISMATCH", "UNSURE"];

export const VERDICT_COPY: Record<Verdict, { word: string; instruction: string; tone: "match" | "mismatch" | "unsure" }> = {
  MATCH: {
    word: "Matches",
    instruction: "This pill matches the FDA record for the medicine on your label.",
    tone: "match",
  },
  SAME_MEDICINE_DIFFERENT_MAKER: {
    word: "Same medicine",
    instruction: "It looks different because another company made it. Same medicine, same strength.",
    tone: "match",
  },
  MISMATCH: {
    word: "Doesn't match",
    instruction: "Don't take this. Call your pharmacy.",
    tone: "mismatch",
  },
  UNSURE: {
    word: "We can't tell",
    instruction: "Ask your pharmacist before you take it.",
    tone: "unsure",
  },
};

export type FeatureResult = "match" | "mismatch" | "unsure";

export type FeatureRow = {
  name: "Imprint" | "Color" | "Shape" | "Size";
  expected: string;
  found: string;
  result: FeatureResult;
};

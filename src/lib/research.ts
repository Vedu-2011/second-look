import type { Product } from "@/lib/fda/types";
import type { Verdict } from "@/lib/verdict";
import { compareImprint } from "@/lib/match/imprint";

export const RESEARCH_SEED = 20261109;
export function shuffled<T>(items: readonly T[], seed = RESEARCH_SEED): T[] {
  const result = [...items];
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export type ResearchImage = {
  file: string;
  url: string;
  ndc: string;
  product: Product;
  generic: string;
};
export type ResearchPair = {
  image: string;
  ownNdc: string;
  labelNdc: string;
  wrong: boolean;
  difficulty: "right" | "easy" | "hard";
};
export function buildPairs(
  images: ResearchImage[],
  seed = RESEARCH_SEED,
): ResearchPair[] {
  const pool = shuffled(images, seed);
  return images.flatMap((image) => {
    const candidates = pool.filter(
      (other) =>
        other.generic !== image.generic &&
        other.product.productCode !== image.product.productCode &&
        compareImprint(other.product.imprintRaw, image.product.imprintRaw)
          .result !== "exact" &&
        compareImprint(image.product.imprintRaw, other.product.imprintRaw)
          .result !== "exact",
    );
    const hard = candidates.find(
      (other) =>
        image.product.shapeCode &&
        image.product.colorCodes.length &&
        other.product.shapeCode === image.product.shapeCode &&
        [...other.product.colorCodes].sort().join() ===
          [...image.product.colorCodes].sort().join(),
    );
    const negative = hard ?? candidates[0];
    if (!negative)
      throw new Error("No valid different-medicine negative for " + image.ndc);
    return [
      {
        image: image.file,
        ownNdc: image.ndc,
        labelNdc: image.ndc,
        wrong: false,
        difficulty: "right" as const,
      },
      {
        image: image.file,
        ownNdc: image.ndc,
        labelNdc: negative.ndc,
        wrong: true,
        difficulty: hard ? ("hard" as const) : ("easy" as const),
      },
    ];
  });
}
export type Observation = ResearchPair & { verdict: Verdict };
export function metrics(rows: Observation[]) {
  const wrong = rows.filter((r) => r.wrong),
    right = rows.filter((r) => !r.wrong);
  const count = (rs: Observation[], verdict: Verdict) =>
    rs.filter((r) => r.verdict === verdict).length;
  const rate = (numerator: number, denominator: number) =>
    denominator ? numerator / denominator : null;
  const caught = count(wrong, "MISMATCH"),
    falseAlarms = count(right, "MISMATCH");
  const passed = right.filter(
    (r) =>
      r.verdict === "MATCH" || r.verdict === "SAME_MEDICINE_DIFFERENT_MAKER",
  ).length;
  const difficultyMetrics = (difficulty: "easy" | "hard") => {
    const group = wrong.filter((r) => r.difficulty === difficulty);
    const caught = count(group, "MISMATCH");
    const unsure = count(group, "UNSURE");
    return {
      n: group.length,
      caught,
      unsure,
      passed: group.length - caught - unsure,
    };
  };
  return {
    n: rows.length,
    wrong: wrong.length,
    right: right.length,
    caught,
    falseAlarms,
    passed,
    unsure: count(rows, "UNSURE"),
    wrongUnsure: count(wrong, "UNSURE"),
    catchRate: rate(caught, wrong.length),
    falseAlarmRate: rate(falseAlarms, right.length),
    passRate: rate(passed, right.length),
    unsureRate: rate(count(rows, "UNSURE"), rows.length),
    easy: difficultyMetrics("easy"),
    hard: difficultyMetrics("hard"),
  };
}
export const percent = (value: number | null) =>
  value === null ? "n/a" : `${Math.floor(value * 1000) / 10}%`;

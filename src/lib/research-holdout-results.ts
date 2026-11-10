import { z } from "zod";
import saved from "../../research/out/holdout-results.json";
import development from "../../research/out/development-results.json";
import { percent } from "./research";
const count = z.number().int().nonnegative(),
  rate = z.number().min(0).max(1).nullable();
const group = z.object({
  n: count,
  caught: count,
  unsure: count,
  passed: count,
});
const metric = z
  .object({
    n: count,
    wrong: count,
    right: count,
    caught: count,
    wrongPassed: count,
    falseAlarms: count,
    passed: count,
    unsure: count,
    wrongUnsure: count,
    decisive: count,
    correct: count,
    decisiveAccuracy: rate,
    coverage: rate,
    catchRate: rate,
    falseAlarmRate: rate,
    passRate: rate,
    unsureRate: rate,
    easy: group,
    hard: group,
  })
  .refine((m) => {
    const equal = (a: number | null, b: number | null) =>
      a === b || (a !== null && b !== null && Math.abs(a - b) < 1e-9);
    return (
      m.n === m.right + m.wrong &&
      m.n > 0 &&
      m.right === m.wrong &&
      m.caught + m.wrongPassed + m.wrongUnsure === m.wrong &&
      m.passed + m.falseAlarms + m.unsure - m.wrongUnsure === m.right &&
      m.decisive === m.n - m.unsure &&
      m.correct === m.caught + m.passed &&
      m.correct <= m.decisive &&
      equal(m.decisiveAccuracy, m.decisive ? m.correct / m.decisive : null) &&
      equal(m.coverage, m.decisive / m.n) &&
      equal(m.catchRate, m.caught / m.wrong) &&
      equal(m.falseAlarmRate, m.falseAlarms / m.right) &&
      equal(m.passRate, m.passed / m.right) &&
      equal(m.unsureRate, m.unsure / m.n) &&
      m.easy.n + m.hard.n === m.wrong &&
      [m.easy, m.hard].every((g) => g.caught + g.unsure + g.passed === g.n) &&
      m.easy.caught + m.hard.caught === m.caught &&
      m.easy.unsure + m.hard.unsure === m.wrongUnsure
    );
  });
export type SafetyMetric = z.infer<typeof metric>;
const schema = z.object({
  version: z.literal(2),
  date: z.string().datetime(),
  frozenCommit: z.string().regex(/^[a-f0-9]{40}$/),
  seed: z.number().int(),
  images: count.min(1),
  products: count.min(1),
  pairs: count,
  hardPairs: count,
  productOverlap: z.literal(0),
  model: z.literal("claude-sonnet-5-5"),
  promptVersion: z.literal("pill-v2"),
  totalUsd: z.number().min(0).max(5),
  metrics: z.record(z.string(), metric),
  readerErrors: count,
  meanReadMs: z.number().nonnegative(),
  meanBaselineMs: z.number().nonnegative(),
});
export type HoldoutResults = z.infer<typeof schema>;
export function loadHoldout(raw: unknown): HoldoutResults | null {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;
  if (
    r.pairs !== r.images * 2 ||
    r.products * 2 !== r.images ||
    r.hardPairs < r.images * 0.8 ||
    r.readerErrors > r.images
  )
    return null;
  for (const name of [
    "Sonnet, one view",
    "Sonnet, two views",
    "Direct Sonnet",
  ]) {
    const m = r.metrics[name];
    if (
      !m ||
      m.n !== r.pairs ||
      m.wrong !== r.images ||
      m.hard.n !== r.hardPairs
    )
      return null;
  }
  return r;
}
export const HOLDOUT_RESULTS = loadHoldout(saved);
const devSchema = z.object({
  images: count,
  pairs: count,
  readingVersion: z.string(),
  metrics: z.record(z.string(), metric),
});
export const DEVELOPMENT_RESULTS = devSchema.safeParse(development).success
  ? devSchema.parse(development)
  : null;
export function holdoutHeadline(r: HoldoutResults) {
  const m = r.metrics["Sonnet, one view"];
  return `On ${r.images} fresh NIH photos (${r.pairs} label–photo pairs), Second Look called ${m.wrongPassed} of ${m.wrong} wrong pills fine. When it answered, it was right ${m.correct} of ${m.decisive} times; it said “can't tell” ${percent(m.unsureRate)} of the time.`;
}

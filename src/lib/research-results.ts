import { z } from "zod";
import saved from "../../research/out/results.json";
import { percent } from "@/lib/research";
const count = z.number().int().nonnegative(),
  rate = z.number().min(0).max(1).nullable();
const metricSchema = z.object({
  n: count,
  wrong: count,
  right: count,
  caught: count,
  falseAlarms: count,
  passed: count,
  unsure: count,
  wrongUnsure: count,
  catchRate: rate,
  falseAlarmRate: rate,
  passRate: rate,
  unsureRate: rate,
  easy: z.object({ n: count, caught: count, unsure: count, passed: count }),
  hard: z.object({ n: count, caught: count, unsure: count, passed: count }),
});
const schema = z.object({
  version: z.literal(1),
  seed: z.number().int(),
  date: z.string().datetime(),
  promptVersion: z.string().min(1),
  models: z.array(z.string()).length(2),
  images: count.min(1),
  products: count.min(80),
  pairs: count,
  skipped: z.array(z.object({ ndc: z.string(), reason: z.string() })),
  totalUsd: z.number().min(0).max(8),
  metrics: z.record(z.string(), metricSchema),
  reading: z.record(
    z.string(),
    z.object({
      exact: count,
      close: count,
      wrong: count,
      noRead: count,
      colorAgree: count,
      shapeAgree: count,
      errors: count,
    }),
  ),
  timing: z.record(
    z.string(),
    z.object({ meanReadMs: z.number().nonnegative() }),
  ),
  baselineMeanMs: z.number().nonnegative(),
});
export type ResearchResults = z.infer<typeof schema>;
export function loadResearch(raw: unknown): ResearchResults | null {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return null;
  const result = parsed.data;
  if (result.pairs !== result.images * 2) return null;
  for (const key of [
    ...result.models,
    ...result.models.map((m) => m + "-no-fold"),
    "baseline",
  ]) {
    const m = result.metrics[key];
    if (
      !m ||
      m.n !== result.pairs ||
      m.wrong !== m.right ||
      m.wrong !== result.images ||
      m.caught > m.wrong ||
      m.falseAlarms > m.right ||
      m.passed + m.falseAlarms > m.right ||
      m.unsure > m.n ||
      m.wrongUnsure > m.wrong ||
      m.hard.n < m.wrong / 2 ||
      m.hard.n + m.easy.n !== m.wrong ||
      m.hard.caught > m.hard.n ||
      m.easy.caught > m.easy.n ||
      m.hard.caught + m.easy.caught !== m.caught ||
      m.hard.unsure + m.easy.unsure !== m.wrongUnsure ||
      [m.easy, m.hard].some(
        (group) => group.caught + group.unsure + group.passed !== group.n,
      )
    )
      return null;
    for (const [actual, expected] of [
      [m.catchRate, m.caught / m.wrong],
      [m.falseAlarmRate, m.falseAlarms / m.right],
      [m.passRate, m.passed / m.right],
      [m.unsureRate, m.unsure / m.n],
    ])
      if (
        actual === null ||
        expected === null ||
        Math.abs(actual - expected) > 1e-9
      )
        return null;
  }
  for (const model of result.models) {
    const r = result.reading[model];
    if (
      !r ||
      r.exact + r.close + r.wrong + r.noRead !== result.images ||
      r.colorAgree > result.images ||
      r.shapeAgree > result.images ||
      !result.timing[model]
    )
      return null;
  }
  for (const m of Object.values(result.metrics))
    if (
      m.caught + m.wrongUnsure > m.wrong ||
      m.unsure < m.wrongUnsure ||
      m.passed + m.falseAlarms + m.unsure - m.wrongUnsure !== m.right
    )
      return null;
  return result;
}
export const RESEARCH_RESULTS = loadResearch(saved);
export function researchHeadline(r: ResearchResults) {
  const m = r.metrics[r.models[0]];
  return `On ${r.images} NIH consumer photos (${r.pairs} label–photo pairs), Second Look with Sonnet caught ${percent(m.catchRate)} of wrong pills with ${percent(m.falseAlarmRate)} false alarms on right pills.`;
}

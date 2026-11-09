// Results for the three demo bottles, computed by the REAL verdict engine from FDA data recorded on RECORDED_ON.
// No network at build time, so /samples always works, even if the FDA APIs are down during judging.
import type { CheckResult } from "@/lib/check-service";
import { SCENARIOS, type Scenario } from "@/lib/demo-scenarios";
import labelsJson from "@/lib/fda/__fixtures__/dailymed-labels.json";
import { parseDailyMedDate, dailyMedUrl } from "@/lib/fda/dailymed-parse";
import { CONCEPTS, RECORDED, RECORDED_ON } from "@/lib/fda/recorded";
import type { LabelMeta } from "@/lib/fda/types";
import { decide, type EngineData } from "@/lib/verdict-engine";

const LABELS: Record<string, LabelMeta> = Object.fromEntries(
  Object.entries(labelsJson as Record<string, { title?: string; published_date?: string } | null>).map(([setId, l]) => [
    setId,
    { setId, title: l?.title ?? null, publishedDate: parseDailyMedDate(l?.published_date), url: dailyMedUrl(setId), current: Boolean(l) },
  ]),
);

const DATA: Record<string, EngineData> = {
  match: {
    labelProduct: RECORDED.perrigoI2Oval,
    labelDrug: CONCEPTS.ibuprofen200,
    sameDrugProducts: RECORDED.ibuprofen200Products,
  },
  "different-maker": {
    labelProduct: RECORDED.advilOval,
    labelDrug: CONCEPTS.ibuprofen200,
    sameDrugProducts: RECORDED.ibuprofen200Products,
  },
  mismatch: {
    labelDrug: CONCEPTS.ibuprofen200,
    sameDrugProducts: RECORDED.ibuprofen200Products,
    guessProducts: RECORDED.acetaminophen500Products,
  },
};

export function sampleResult(s: Scenario): CheckResult {
  const data = DATA[s.id];
  const result = decide(s.label, s.pill, data);
  return {
    ...result,
    label: s.label,
    pill: s.pill,
    labelProduct: data.labelProduct ?? null,
    labels: LABELS,
    checkedAt: `${RECORDED_ON}T12:00:00.000Z`,
    timings: { label: 0, drug: 0, guess: 0, dailymed: 0, total: 0 },
  };
}

export const SAMPLE_RESULTS = SCENARIOS.map((s) => ({ scenario: s, result: sampleResult(s) }));

import { metrics, type Observation } from "./research";
export function safetyMetrics(rows: Observation[]) {
  const base = metrics(rows);
  const wrongPassed = rows.filter(
    (r) =>
      r.wrong && ["MATCH", "SAME_MEDICINE_DIFFERENT_MAKER"].includes(r.verdict),
  ).length;
  const decisive = base.n - base.unsure,
    correct = base.caught + base.passed;
  return {
    ...base,
    wrongPassed,
    decisive,
    correct,
    decisiveAccuracy: decisive ? correct / decisive : null,
    coverage: base.n ? decisive / base.n : null,
  };
}

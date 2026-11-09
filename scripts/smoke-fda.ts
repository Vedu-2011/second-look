// Live smoke test: runs the 3 demo scenarios against the REAL RxNav + DailyMed APIs and prints verdicts and timings.
// Uses the in-memory cache only (no Redis env), so the first pass is cold and the second is warm.
// Run: npm run smoke:fda
import { clearMemoryCache } from "@/lib/fda/cache";
import { runCheck } from "@/lib/check-service";
import { SCENARIOS } from "@/lib/demo-scenarios";

async function main() {
  clearMemoryCache();
  let failed = 0;
  for (const pass of ["cold", "warm"] as const) {
    console.log(`\n== ${pass} ==`);
    for (const s of SCENARIOS) {
      const r = await runCheck(s.label, s.pill);
      const ok = r.verdict === s.expect;
      if (!ok) failed++;
      const who = r.identifiedAs ?? r.matchedProduct ?? r.expected;
      console.log(
        `${ok ? "PASS" : "FAIL"} ${s.id.padEnd(16)} ${r.verdict.padEnd(30)} ${String(r.timings.total).padStart(5)} ms` +
          `  (label ${r.timings.label}, drug ${r.timings.drug}, guess ${r.timings.guess}, dailymed ${r.timings.dailymed})` +
          `  compared ${r.productsCompared}` +
          (who ? `  → ${who.title} · ${who.labeler} · NDC ${who.ndc9}` : ""),
      );
      if (pass === "cold") for (const reason of r.reasons) console.log(`     - ${reason}`);
      if (pass === "cold") for (const e of r.evidence) console.log(`     · ${e.source}: ${e.url}${e.setId && r.labels[e.setId] ? ` (published ${r.labels[e.setId].publishedDate})` : ""}`);
    }
  }
  process.exitCode = failed ? 1 : 0;
}

main();

# Second Look

## Problem and who has it

A refill can look different even when it is the same medicine, and a pill that looks familiar can still be the wrong one. Patients and caregivers need a clear way to compare the pill with the prescription label and see what evidence supports the result. Second Look reads the label and pill photos, checks FDA and NLM records, and gives a cautious answer with a link to its evidence.

## Method

The rule is **AI reads; code decides**. Claude reads the printed label and pill appearance. Code looks up the label’s product in FDA DailyMed and NLM RxNorm/RxNav, then compares the imprint, color, and shape. AI does not decide whether a pill matches. The result links to the records used. Low confidence, missing records, or conflicting appearance can lead to “Can't tell. Ask your pharmacist.” A photo cannot measure pill size, so size is displayed from the FDA record and is not used as a pass/fail check.

## Evaluation

**Safety first:** on the frozen one-view test, **1 of 150 wrong pills was called fine**. The system abstained on **212 of 300 pairs (70.6%)**, so it often did not have enough evidence to answer. Zero or one observed wrong pass in this small test does not establish safety.

I froze the implementation before evaluation (commit `7cb343a9bf00668b77a20465edc2a884160f60ec`). The holdout used 150 consumer photos of 75 new NDC products from the NIH/NLM pill image dataset. Each photo was paired with its correct label and a deliberately wrong label, for 300 balanced label–photo pairs. Selection was product-disjoint from development and deliberately included look-alikes: 126 of 150 wrong pairs were hard look-alikes. These archive photos show one side of a pill. The primary method was predeclared as one-view Claude Sonnet 5.5 plus deterministic FDA matching. The baseline saw the same photos and label details and was asked directly whether the pill was right, without an FDA lookup. It is a comparison of two complete systems, not an isolated test of code versus AI.

“Correct / decisive” means correct among answers that were not “Can't tell.” Coverage means the share of all pairs with a decisive answer. The test treated wrong pills called fine, false alarms, and abstentions as separate outcomes.

| Frozen method | Wrong pills called fine | False alarms on right pills | Correct / decisive | Coverage | “Can't tell” |
|---|---:|---:|---:|---:|---:|
| Second Look, one view | 1/150 | 4/150 | 83/88 (94.3%) | 29.3% | 212/300 (70.6%) |
| Second Look, two views | 0/150 | 4/150 | 46/50 (92%) | 16.6% | 250/300 (83.3%) |
| Ask Sonnet directly | 2/150 | 9/150 | 83/94 (88.2%) | 31.3% | 206/300 (68.6%) |

Two views had no wrong pass in this sample, but answered less often and had no better false-alarm count. I report the one-view result as the headline because it was the predeclared method. The test also found a short-imprint look-alike that passed incorrectly. A later fix removed that observed pass in a cached post-hoc rescore; because the holdout informed the fix, that rescore is not fresh evidence and does not replace the frozen table.

The [report](../research/REPORT.md), [interpretation](../research/INTERPRETATION.md), [individual outcomes](../research/out/holdout-results.json), and [source data manifest](../research/HOLDOUT-DATA.md) document the test. The historical run used seed `20261110` and prompt `pill-v2`. The current app has changed since the frozen implementation, so replaying against current source fails its hash guard. The following cache-only replay uses the exact frozen commit and the saved inputs on the `ai-for-medicine` branch. It needs no API key and makes no model calls. From a fresh terminal, run:

```sh
git clone --branch ai-for-medicine https://github.com/Vedu-2011/second-look.git second-look
cd second-look
git worktree add --detach /tmp/sl-frozen 7cb343a9bf00668b77a20465edc2a884160f60ec
mkdir -p /tmp/sl-frozen/research/out
for f in cohort.json holdout-cohort.json holdout-readings.json holdout-baseline.json holdout-freeze.json holdout-cost.json; do
  cp "research/out/$f" "/tmp/sl-frozen/research/out/$f"
done
cd /tmp/sl-frozen
npm ci
npm run research
```

The runner regenerates `research/out/holdout-results.json` and `research/REPORT.md` from those cached readings and prints the frozen table. The copied files are inputs, not the result being checked. If any saved model reading is missing, the run stops; it does not call a model unless `--run` is explicitly added. Replacing missing readings requires an Anthropic API key and paid calls, subject to the runner's $5 cap. I did not make any new model calls for this evaluation replay.

## Who benefits, and who could be harmed

Patients and caregivers may use the evidence links to ask a pharmacist about a possible mix-up or a different-looking refill. A wrong pill called fine could expose someone to the wrong medicine. A false alarm can cause worry or delay a correct medicine, and “Can't tell” can leave a person without an answer. Second Look limits these risks by abstaining when it lacks evidence, showing the FDA record, and directing people to a pharmacist. It cannot guarantee that a pill is safe to take.

## Limitations

This was a small, look-alike-enriched test using 2016-era NIH archive photos, not current photos from patients or pharmacies. It tested one side at a time; the two-view results combine independent archive views that are not guaranteed to show opposite sides of the same physical pill. The high abstention rate limits usefulness. This is not clinical validation, and the comparison does not prove that the FDA lookup caused the difference from the direct-AI baseline. The system supports tablets and capsules with US FDA records. It cannot establish pill authenticity, and a single photo cannot measure size. The historical holdout has since informed a change, so it must not be used as an untouched test for future tuning.

## What I'd do with another month

I would work with a pharmacist and caregivers to gather consented, current phone photos, then test on a new product-disjoint holdout. I would investigate why the system abstains, improve reading of faint imprints and both sides, and measure whether people can understand and act on its answers. I would keep the existing holdout out of tuning.

## AI tools

Claude Code and Codex wrote the code under my direction; Claude (Anthropic API) reads the photos in the app.

## Attribution

- **Data:** NIH/NLM Pill Image Recognition Challenge consumer photos; FDA DailyMed label and pill-appearance records; NLM RxNorm/RxNav product records. See [the research report](../research/REPORT.md) and [the project README](../README.md#real-data).
- **Models:** Anthropic Claude Sonnet 5.5 for the frozen pill-reading evaluation and Anthropic Claude models in the app.
- **Libraries and hosting:** Next.js, React, Tailwind CSS, Base UI, Anthropic TypeScript SDK, Upstash Redis, class-variance-authority, `cn`, Lucide, qrcode.react, shadcn, tw-animate-css, Recharts, Zod, Sharp, Vitest, TypeScript, ESLint, Playwright, Lighthouse, and Vercel. See [package.json](../package.json).

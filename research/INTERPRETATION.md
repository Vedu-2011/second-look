# Phase 5: the coverage goal was not met

This interpretation was written after the frozen holdout. No implementation, threshold, prompt or pair rule was changed after the run. Frozen commit: `7cb343a9bf00668b77a20465edc2a884160f60ec`.

The one-view pipeline abstained on 212/300 pairs (70.6%, truncated), versus 250/300 (83.3%) for two views. Neither demonstrates the requested reduction in uncertainty. The new cohort differs from development, so these are not causal before/after estimates. On the same holdout, strict two-view combination reduced coverage from 88/300 to 50/300. It had zero observed wrong passes, versus one for one view, but this is not proof of safety.

| Holdout method | Wrong caught / 150 | Wrong called fine / 150 | False alarms / 150 right | Right passed / 150 | Correct / answered | Coverage / 300 | Unsure / 300 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Sonnet, one view | 46 | 1 | 4 | 37 | 83/88 (94.3%) | 88 (29.3%) | 212 (70.6%) |
| Sonnet, two views | 26 | 0 | 4 | 20 | 46/50 (92%) | 50 (16.6%) | 250 (83.3%) |
| Direct Sonnet | 45 | 2 | 9 | 38 | 83/94 (88.2%) | 94 (31.3%) | 206 (68.6%) |

All methods have 300 pairs from 150 photos of 75 new products, with 126/150 hard wrong pairs. Percentages are truncated, never rounded up. Single-view Sonnet was predeclared as the headline; the headline was not switched to two views to advertise its zero wrong passes.

## A concrete wrong pass, not hidden

The one-view error was `research/data/holdout-68180051303-1.jpg`, labeled in the dataset as NDC `68180051303` (FDA: lisinopril 5 mg, imprint `5`). The deliberately wrong label was `23155012401` (ropinirole 2 mg, imprint `H;124`). The reader transcribed `5` with confidence 0.9. The engine found another product in the label's same-drug group, `43547-598`, whose FDA imprint is `598;S`. The existing `5`/`S` folding and visible-subset rule produced SAME_MEDICINE_DIFFERENT_MAKER. The reading was not invented; a weak, confusable single-character match was not specific enough. These are benchmark FDA mappings, not advice about either medicine.

That rule predates phase 5. The new evidence does not justify claiming the older release is safer on this cohort; it was not independently reread with the old prompt. It does show why zero wrong passes on development cannot establish safety. The code was not patched against this case and the same cohort was not retested after tuning.

## What did work

All 150 reader operations produced schema-valid outputs, with zero reader errors and no development rereads. The optional flip/skip flow and continuation reuse pass unit/browser tests. Strict two-view merging passed no wrong pairs in this sample, at a substantial coverage cost. The direct baseline had one nonconforming reply, retained as UNSURE.

Estimated new model spend: **$3.062534 / $5** (150 readings + 300 direct classifications). A complete cached regeneration with the API key unset leaves the ledger unchanged. Model timings exclude label OCR, FDA lookup, explanation, upload and UI.

## Release decision and next evidence

Main remains unchanged because the phase's coverage goal was not met. The feature branch and preview retain every result. Do not present this as an accuracy improvement or a clinically safe release.

Any next investigation should use development data to study missing/low-confidence text, appearance disagreement and insufficiently specific single-character matches. If this holdout informs a change, it becomes development data. A further release claim requires another disjoint, untouched holdout and a newly agreed budget; no additional model calls are authorized by this report.

# Second Look: development and fresh holdout

**Release goal not met:** the one-view pipeline abstained on 212/300 pairs and called one wrong pill fine; two views abstained on 250/300. Main remains unchanged. See [the post-run interpretation and concrete wrong-pass audit](INTERPRETATION.md). This section is documentation-only; the frozen implementation was not changed.

Holdout run 2026-11-10T21:46:49.656Z. Frozen implementation commit **7cb343a9bf00668b77a20465edc2a884160f60ec**. Seed 20261110, model claude-sonnet-5-5, prompt pill-v2. 150 photos / 75 new NDC products / 300 pairs; 126/150 wrong pairs are hard look-alikes. Zero development product-code overlap, including package aliases. No implementation changes are allowed after viewing holdout outcomes; hashes are enforced by the runner. Headline method was predeclared as one-view Sonnet, not selected by results.

## Holdout: every safety and usefulness metric together

| Method | Wrong caught | Wrong called fine | False alarms | Right passed | Correct / decisive | Coverage | Unsure |
|---|---:|---:|---:|---:|---:|---:|---:|
| Sonnet, one view | 46/150 | 1/150 | 4/150 | 37/150 | 83/88 | 29.3% | 212/300 |
| Sonnet, two views | 26/150 | 0/150 | 4/150 | 20/150 | 46/50 | 16.6% | 250/300 |
| Direct Sonnet | 45/150 | 2/150 | 9/150 | 38/150 | 83/94 | 31.3% | 206/300 |

Decisive means not UNSURE. Correct decisive answers = right pills passed + wrong pills marked MISMATCH. Wrong passes, false alarms and abstentions are never counted as correct. Do not describe zero observed wrong passes as proven safety.

## Development, never a test headline

The phase-4 200-photo / 100-product cohort is DEVELOPMENT data now. Its original pill-v1 one-view result was 77/200 wrong caught, 0/200 wrong called fine, 2/200 false alarms, 64/200 right passed, 141/143 correct decisive answers and 143/400 coverage. dev-diagnosis.md records all abstentions; dev-diagnosis.json has all 400 rows. Development two-view evaluation reuses v1 caches with the phase-5 engine, NOT new v2 readings. See development-results.json and PHASE4-REPORT.md. No development images were reread: the entire new budget was reserved for holdout. The optional extra partial-side relaxation was not adopted; the existing matcher already accepts visible subsets.

## Protocol and limitations

Only consumer C3PI_Test JPG rows from the NIH index, single-part products; two seeded views of 75 product-disjoint codes. To meet the predeclared hard-negative floor, we took the first 100 seeded eligible metadata records, selected 60 in mutual hard-negative pairs, then filled 15 from the remaining seeded order. This look-alike-stratified selection is not prescription-population sampling. FDA imprint, color, shape and all same-drug alternatives come from our RxNav ndcstatus=ALL client and are frozen in holdout-cohort.json. Exact URLs, hashes and skips are in HOLDOUT-DATA.md. Known label NDC, not label OCR. Same deterministic pair rules as development: balanced truth, different generic medicine, non-equivalent imprint, at least 80% hard pairs. Selection and exclusions happened before model outputs. 14 candidates skipped; individual reasons are recorded. 43 selected records are inactive/discontinued.

Two-view evaluation merges both existing photos of each product. They are independent archive views, not guaranteed opposite sides or the same physical tablet. There are only 75 unique view-pairs; each is reused for two anchors. All observations are correlated by product and anchor. Two-view union preserves the minimum confidence of nonblank text, ignores a blank side for imprint confidence, and requires exact color agreement plus compatible shape and trusted appearance in both. Conflicts remain UNSURE. Empty/failed readings remain in denominators. Long/odd strings are cleaned and bounded; trimmed imprint confidence is capped below 0.7. The imprint threshold remains 0.7.

Direct baseline sees the same single photos and label drug/strength/NDC, no FDA lookup. Its frozen settings are max_tokens=128, thinking.type=between_tools, output_config.effort=high; reader reasoning retains production defaults. Nonconforming baseline text counts UNSURE. This is a system comparison, not an isolated causal test of deterministic code. Dataset is public and from the 2016 challenge era; training overlap, record changes and controlled backgrounds limit generalization. No size or authenticity measurement, no clinical validation. Different development/holdout distributions prevent a causal before/after accuracy claim.

## Cost, timing, reproduction

New estimated spend **$3.062534 / $5**, separate from phase 4's $6.6680584. Every uncached operation reserves token-count input headroom and maximum output/reader retry costs across in-flight requests before launch. SDK network failures without returned usage cannot be billed from the ledger. Both-view evaluations reuse existing reads, with no extra API calls; a real two-photo check would pay for two reads. Mean one-photo read 2.446 s; direct baseline 1.093 s/pair. These exclude label OCR, FDA lookup, explanation, upload and UI. Reader errors: 0/150, retained as UNSURE.

Run npm run research (fully cached report regeneration, no --run). A new paid run requires explicit --run and an existing matching freeze; never reset it to hide a second run. All readings, raw direct replies, usage ledger, all 900 pair outcomes, cohort and freeze hashes are committed. Photos remain ignored; missing files are restored only when a new read needs them, and hashes checked. Holdout outcomes may be reported, not used to tune this release. Future tuning requires another development set and a new untouched holdout.

[NIH index](https://data.lhncbc.nlm.nih.gov/public/Pills/directory_consumer_grade_images.txt) · [Yaniv et al., dataset paper](https://pubmed.ncbi.nlm.nih.gov/29854569/)

## Development only: current engine, cached v1 readings

| Method | Wrong caught | Wrong called fine | False alarms | Right passed | Correct / decisive | Coverage | Unsure |
|---|---:|---:|---:|---:|---:|---:|---:|
| Sonnet, one view | 66/200 | 0/200 | 2/200 | 56/200 | 122/124 | 31% | 276/400 |
| Sonnet, two views | 34/200 | 0/200 | 2/200 | 32/200 | 66/68 | 17% | 332/400 |
| Direct Sonnet | 91/200 | 3/200 | 9/200 | 49/200 | 140/152 | 38% | 248/400 |

Shape cleanup recognizes literal “-shaped” suffixes. Single-view engine checks now honor multiple/absent-pill signals, consistent with the camera pipeline; this adds abstentions versus phase 4, whose pure benchmark engine ignored those flags. The thresholds were not lowered. Strict two-view compatibility costs coverage on development; no outcome was discarded to hide this. The initial unstratified metadata-only holdout candidate pool failed the hard-negative floor. No model call had occurred; the stratification described above was fixed before freezing.

Mean model cost per new single-view check $0.010721; direct classification $0.004848. Two-view model-reading cost would be approximately twice a single read, excluding label/explanation. Development reread spend: $0.

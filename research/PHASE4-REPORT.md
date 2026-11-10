# Second Look: NIH consumer-photo test

Run 2026-11-10T18:35:49.333Z. Seed 20261109; 200 images, 100 distinct NDC products, 400 pairs. Prompt pill-v1. These are observed engineering measurements, not clinical accuracy or errors prevented.

## Method

Only C3PI_Test JPG consumer photos from the [NIH index](https://data.lhncbc.nlm.nih.gov/public/Pills/directory_consumer_grade_images.txt). Product codes were seeded-shuffled; first 100 with two eligible photos, a resolvable RxNav drug group, and an FDA imprint were retained. 32 candidates were excluded (5 without an imprint/product; the remaining reasons are listed individually in DATA.md). 67 selected products are marked inactive/discontinued. We checked part numbers in the index: all selected products have a single part. Each photo appears once with its correct NDC and once with a different generic medicine, never an equivalent manufacturer change. 168 of 200 wrong pairs share the FDA color and shape but have a different imprint; the others are easy negatives. Labels and hard-negative selection use FDA metadata, not model answers. The completed cohort is fixed in out/cohort.json, including exact ground-truth product groups.

Both models call the exact production readPill with env-selected model and normal validation retry. No label-photo reading or explanation is evaluated. Single-visible-side imprint matching counts as exact; close allows confusable letters/numbers. Reader failures count as no-read/UNSURE, not exclusions. Color and shape agreement include exact or close matches. For verification the production decide function receives the known label NDC and its full recorded same-drug product group. The no-fold ablation only disables character folding. The direct baseline uses Sonnet and the same pairs, shown the photo and label drug/strength/NDC, with no tool lookup. Nonconforming baseline text becomes UNSURE; raw answers are saved. Haiku has a pipeline result, not an unrequested direct baseline.

## Verification counts

| Method | Wrong caught | False alarms | Right passed | Unsure overall | Easy caught | Hard caught |
|---|---:|---:|---:|---:|---:|---:|
| claude-sonnet-5-5 | 77/200 | 2/200 | 64/200 | 257/400 | 10/32 | 67/168 |
| claude-sonnet-5-5-no-fold | 77/200 | 2/200 | 64/200 | 257/400 | 10/32 | 67/168 |
| claude-haiku-5-5 | 56/200 | 6/200 | 41/200 | 297/400 | 7/32 | 49/168 |
| claude-haiku-5-5-no-fold | 56/200 | 6/200 | 41/200 | 297/400 | 7/32 | 49/168 |
| baseline | 91/200 | 9/200 | 49/200 | 248/400 | 28/32 | 63/168 |

Catch rate is wrong MISMATCH / all wrong. False alarm rate is right MISMATCH / all right. Right pass rate is MATCH or SAME_MEDICINE / all right. UNSURE stays in every denominator and is never called a catch. Right + wrong balance is 200 + 200. Read the ratios directly; the site truncates percentages to one decimal.

## Reading counts

| Model | Exact | Close | Wrong | No read | Color agree | Shape agree | Reader errors |
|---|---:|---:|---:|---:|---:|---:|---:|
| claude-sonnet-5-5 | 119 | 1 | 26 | 54 | 157/200 | 184/200 | 8 |
| claude-haiku-5-5 | 94 | 0 | 56 | 50 | 147/200 | 178/200 | 15 |

## Time and estimated spend

- claude-sonnet-5-5: mean reading 2.858 s/image; estimated $0.010800 per new image/check (one reading reused for two benchmark pairs).
- claude-haiku-5-5: mean reading 3.809 s/image; estimated $0.000764 per new image/check (one reading reused for two benchmark pairs).
- Direct Sonnet baseline: 1.436 s/pair and $0.004862 estimated per pair.
- Total estimated model spend: $6.668058. Hard limit $8; uncached requests now use token-count preflight, 10% plus 4,096 input-token headroom, maximum output and all reader attempts. The combined in-flight bound is reserved before starting. The original completed run used $0.10 per operation and stayed below the cap. Token usage is saved after each completed model response. Failed network requests with no usage response cannot be measured. Pricing: Sonnet $2/$10 per million input/output tokens; Haiku $0.10/$0.50 for these short prompts ([Anthropic pricing announcement](https://www.anthropic.com/claude-haiku-5-5)). No cache-write tokens are requested.
- These timings measure model reading/direct classification, not the full app: label OCR, FDA network lookup, explanation, image upload and UI are excluded.

## Reproduce and audit

Run npm install then npm run research with ANTHROPIC_API_KEY in ignored .env.local. research/data is gitignored. If data is absent, the committed cohort restores only those 200 images and verifies resized hashes; it does not resample. Cached readings are keyed by model, production prompt version and image SHA256. A completed rerun makes no model calls. out/results.json, out/pairs.csv, both readings caches, baseline.json, cost.json and cohort.json are auditable. DATA.md lists exact URLs, filenames and exclusions. Source file hashes in results.json identify the evaluation implementation.

## Limits and interpretation

The archive reflects the 2016 challenge era; some products are discontinued and FDA mappings have changed. Consumer photos are controlled photographs of single pills on backgrounds, not all real phone conditions. One view can hide the imprint. Size is not measured. Selection excludes products without usable ground truth and may not represent US prescriptions. There are two photos per product and each photo contributes two pairs: observations are correlated, not 400 independent clinical cases. Hard negatives are from this cohort, not every possible look-alike. Models may have seen these public images in training. There is no independent holdout for model development. No statistical significance or superiority claim is inferred from these counts. If the baseline wins, it is reported without changing the cohort or thresholds.

Dataset citation: [Yaniv et al., National Library of Medicine pill image recognition challenge](https://pubmed.ncbi.nlm.nih.gov/29854569/). See [NIH archive](https://data.lhncbc.nlm.nih.gov/public/Pills/index.html).

## Baseline configuration

The initial 400-pair baseline used default adaptive thinking and max_tokens 128. Of those requests, 382 produced nonconforming replies (381 empty): this was an output-budget failure, not evidence of wrong-pill detection. Before publication, every baseline pair was repeated. Initial replies remain in baseline.json and all pilot spend is counted. The reported baseline uses thinking.type=between_tools, output_config.effort=high, max_tokens=128 (baseline-v2): https://platform.claude.com/docs/en/build-with-claude/thinking. Every pair uses v2, without selection by correctness. Production readers retain normal reasoning settings, so this compares system configurations, not an isolated causal effect of code alone. The prompt requests one word; invalid final text counts as UNSURE. 1 final baseline replies were nonconforming.

## What we learned

Sonnet's pipeline caught 77/200 wrong pills with 2/200 false alarms and 257/400 abstentions. Direct AI caught 91/200, with 9/200 false alarms. The pipeline caught fewer wrong pills but raised fewer false alarms; it does not win overall accuracy. Its right-pill pass rate is low. Blank-side and unreadable photos were not discarded. The ablation produced the same verification outcomes on this cohort, so it provides no measured folding benefit here. Reader failures include overlong imprint/shape/form strings rejected by the unchanged production schema. Next investigate tighter transcription constraints, clearer schema descriptions, crop/lighting guidance and optional second-side capture, then evaluate those changes on a fresh held-out cohort. Do not tune thresholds on this set and relabel it an independent test.

## All wrong-pill outcomes by difficulty

| Method | Difficulty | Wrong pairs | Caught | Unsure | Incorrectly passed |
|---|---|---:|---:|---:|---:|
| claude-sonnet-5-5 | easy | 32 | 10 | 22 | 0 |
| claude-sonnet-5-5 | hard | 168 | 67 | 101 | 0 |
| claude-sonnet-5-5-no-fold | easy | 32 | 10 | 22 | 0 |
| claude-sonnet-5-5-no-fold | hard | 168 | 67 | 101 | 0 |
| claude-haiku-5-5 | easy | 32 | 7 | 25 | 0 |
| claude-haiku-5-5 | hard | 168 | 49 | 119 | 0 |
| claude-haiku-5-5-no-fold | easy | 32 | 7 | 25 | 0 |
| claude-haiku-5-5-no-fold | hard | 168 | 49 | 119 | 0 |
| baseline | easy | 32 | 28 | 4 | 0 |
| baseline | hard | 168 | 63 | 102 | 3 |

False alarms and right-pill pass rates apply to the shared 200 right pairs, not to wrong-pair difficulty categories. Every wrong-pair outcome is shown above; UNSURE is not a successful detection.

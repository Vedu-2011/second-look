# HANDOFF log — newest entry on top
Claude Code adds a new entry at the top after every task (format in ~/Hackathons/CLAUDE.md).
The planner reads this file when Vedhanth says "handoffs". Never delete old entries.

## 2026-11-10 — Phase 5: two views and a fresh holdout — prompts/phase-5.md

BUILDER: Codex
HANDOFF — Phase 5
STATUS: PARTIAL — implementation, frozen holdout, audit, final screenshots and feature preview are complete. The release goal was NOT met, so main/production are unchanged. Remaining task 8 main push/production acceptance requires Vedhanth's direction; do not silently override the gate.

WHAT I DID / DEVELOPMENT DIAGNOSIS
- Worked on feat/phase-5. Original phase-4 data is now DEVELOPMENT, never the fresh headline. Saved research/out/dev-diagnosis.{md,json}: all 400 pairs, every UNSURE/no-read and ten fixed-order examples. The original 257 abstentions have overlapping flags: 244 low imprint confidence, 108 no-imprint pair outcomes, 42 partial matching imprints, 69 color disagreements, 25 shape disagreements, 16 reader-error outcomes (8 photos), and 137 possible unseen-side cases inferred from FDA multipart text (not proven). There are 54 no-read photos. Discontinued status is context, not an abstention cause.
- Additional cached diagnosis: 44 exact transcriptions below confidence 0.7; 17 photos with a multiple-pill signal that the old pure benchmark engine ignored (the camera pipeline already rejected it). No development photo was reread with v2; spend on development was $0.
- Current-engine development with old v1 readings: one view 66 wrong caught, 0 wrong passed, 2 false alarms, 56 right passed, 122/124 correct decisive, 124/400 coverage; two views 34 caught, 0 wrong passed, 2 false alarms, 32 right passed, 66/68 correct decisive, 68/400 coverage. Strict merging made abstention worse. Cached direct baseline is also shown with all safety metrics.

EXACT CHANGES AND WHY — ALL BEFORE FREEZE
- src/lib/ai/prompts/read-pill.ts: pill-v1 -> pill-v2. Ask only for stamped characters, [] for blank sides, short imprint/shape/form fields; explain confidence as literal legibility rather than medicine identity. Never fill missing characters or raise confidence because a pill seems familiar.
- src/lib/ai/clean-pill.ts + readers.ts: clean control characters/blank descriptors, bound long strings/arrays, normalize color words, retain readable text. Lossy imprint cleanup/uncertainty caps confidence at 0.69. Lossy appearance cleanup lowers appearance confidence and caps imprint confidence too, preventing it becoming a confident verdict. Malformed types still fail validation/retry. No confidence is increased by cleanup.
- src/lib/pill-views.ts: merge one or two readings of the SAME pill. Union nonblank side strings, deduplicate identical strings, minimum confidence among nonblank text; a blank side contributes no imprint confidence. Both views need trusted, exact color agreement and exact/close compatible shapes. Missing/unclear appearance, conflicting appearance, multiple/absent pills -> viewConflict -> UNSURE. No claim that the code can prove two photos show the same physical pill.
- src/lib/verdict-engine.ts: decide accepts a reading or a readonly pair, merges pairs before normal matching, and returns UNSURE for viewConflict/multiple/explicitly absent pill. No thresholds, confusable map, rankings or existing partial-side acceptance changed. Optional looser partial-side rule was NOT adopted; the old matcher already accepts visible subsets.
- src/lib/match/shape.ts: recognize the literal “-shaped” suffix (capsule-shaped, oval-shaped, round-shaped), supported by cached development strings; tested all three.
- photo-check/check-input/API/flip-store/check-flow: optional “Flip the pill over and take one more photo” after no/unclear/partial/multipart text, one-tap skip. Random server-owned 10-minute continuation, sl:flip: Redis keys, bounded local fallback. Only the second photo is read; label/first reading are not paid again. Skip reuses first result. Reject expired/forged continuation requests. Both photos display locally; uploaded photos are not stored in shared results. Friendly timeout/early-stream handling. Sample replay opts out of the interactive step to retain its original behavior.
- Research: new safety/coverage metric math and strict loader; development/holdout separation, two charts, all-method safety tables, predeclared one-view headline, README/home update. Archived original report as PHASE4-REPORT.md. Old phase-4 runner refuses implicit v2 rereads.

FREEZE / COHORT / RESEARCH HYGIENE
- Frozen implementation commit: **7cb343a9bf00668b77a20465edc2a884160f60ec**. Freeze metadata committed in 2253b6c. All tracked src/scripts/package hashes and cohort hash are in holdout-freeze.json. Zero implementation changes after seeing holdout outcomes; exact diff against the frozen commit remains empty for those paths.
- New seed 20261110: 150 consumer photos / 75 new NDC product codes / 300 balanced pairs (150 right, 150 wrong). 126/150 wrong pairs are hard look-alikes (84%). Excluded every development product code including package aliases; independently verified zero product-code, URL and image-SHA256 overlap.
- Initial unstratified 75-code metadata-only pool failed the 80% hard floor and stopped BEFORE ANY model call. Before freeze, selected 60 codes in mutual hard-negative pairs from the first 100 seeded eligible metadata records, plus 15 additional seeded codes. This look-alike-stratified selection is disclosed, not population-random sampling. 14 metadata candidates excluded: 13 no drug group, 1 no FDA imprint/product. Exact URLs/hashes/skips and full FDA groups are in HOLDOUT-DATA.md / holdout-cohort.json.
- One-view Sonnet was fixed as the headline before testing, not switched to the two-view zero-wrong-pass method after seeing results. Sonnet model claude-sonnet-5-5; pill-v2; direct baseline max_tokens=128, thinking.type=between_tools, output_config.effort=high. No Haiku, development rereads, post-holdout tuning or second paid holdout run.

FINAL HOLDOUT TABLE — ALL METRICS TOGETHER
| Method | Wrong caught / 150 | Wrong called fine / 150 | False alarms / 150 right | Right passed / 150 | Correct / answered | Coverage / 300 | Unsure / 300 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Sonnet, one view | 46 | 1 | 4 | 37 | 83/88 (94.3%) | 88 (29.3%) | 212 (70.6%) |
| Sonnet, two views | 26 | 0 | 4 | 20 | 46/50 (92%) | 50 (16.6%) | 250 (83.3%) |
| Direct Sonnet | 45 | 2 | 9 | 38 | 83/94 (88.2%) | 94 (31.3%) | 206 (68.6%) |

Percentages truncated, never rounded up. Correct decisive = wrong caught + right passed; mistakes and abstentions never count as correct. Two-view evaluation uses only 75 unique view-pairs, reused for two anchors; observations are correlated.

SPEND / TIME / CACHING
- Total NEW estimated spend **$3.062534 / $5**: 150 reading responses + 300 direct responses, no extra retry response observed. Model-reading mean 2.446 seconds / $0.010721 per photo; direct baseline 1.093 seconds / $0.004848 per pair. Both views reuse the 150 recorded reads for evaluation; real two-photo checks pay for two reads. Times exclude label OCR, FDA lookup, explanation, upload and UI.
- Reader errors: 0/150. Direct nonconforming replies: 1/300, retained as UNSURE. All caches/raw replies/cost ledger and 900 CSV outcomes retained. No photo removed for a poor answer.
- Full cached regeneration with ANTHROPIC_API_KEY unset: PASS; no new calls. Cost-ledger SHA256 unchanged: ad53f4adc0fd6ec9b275242e231d97119113c08fa93d13edbd2502e894bc03d9. Phase-4 ledger remains separate and unchanged. $1.937466 remains below the cap; do not spend it on tuning/retesting this holdout.

WHAT WENT WRONG / RELEASE GATE
- The requested substantial reduction in UNSURE was NOT demonstrated. Single-view holdout abstention is 70.6%; two views 83.3%. Different development/holdout distributions preclude a causal “worse prompt” or “better prompt” claim, but the goal was not met. Strict two-view merging reduces coverage on the same holdout too.
- Concrete wrong pass: holdout-68180051303-1.jpg, own NDC 68180051303 / FDA lisinopril 5 mg / imprint “5”; deliberately wrong label 23155012401 / ropinirole 2 mg / “H;124”. Reader saw “5” at 0.9 confidence. Existing same-drug alternative 43547-598 has “598;S”; existing 5/S folding + visible-subset acceptance returned SAME_MEDICINE_DIFFERENT_MAKER. See INTERPRETATION.md. This rule predates phase 5. It was NOT patched against this holdout case. The old release was not independently reread on this cohort, so do not claim it is safer here.
- Zero development wrong passes did not establish safety. Two-view zero observed wrong passes here is not proof of safety. Public 2016-era controlled photos, changed/discontinued records, possible pretraining overlap, known NDC not label OCR, no size/authenticity measurement and correlated observations remain limits.
- Main/production must remain phase 4 unless Vedhanth explicitly accepts this failed-goal release or authorizes another development/untouched-holdout cycle. Do not quietly tune and rerun these photos.

TESTS / REVIEW / FILES
- PASS 190 tests / 26 files, lint, TypeScript, production build (two existing non-fatal Atkinson warnings). New tests cover merge conflicts/blank/partial/hard-look-alike cases, cleanup, photo continuation reuse/skip/expiry, metrics/loader integrity and input validation.
- Browser at 375 + 1440 PASS, repeated after the holdout data build: correct 150-photo / 300-pair headline (1 wrong passed, 83/88 correct answered, 70.6% unsure), two charts, separate development table, flip/skip/continuation-only other-side upload, both result photos and no overflow/runtime errors. Browser AI is mocked; no live app AI call claimed. Final research/flip screenshots at both widths saved in docs/screenshots/phase-5/ and visually inspected.
- Independent Python CSV/JSON audit PASS: all 900 rows, all method counts/accuracy/coverage, cohort/source hashes, hard selection, disjointness and ledger totals. Downloaded NIH photos remain ignored.
- Pre-freeze Codex review: no code blockers, required replacing null holdout/missing CSV before shipping. Those artifacts now exist and validate. Separate final Codex artifact/self-review confirms complete counts, no misleading improvement claim, preserved source freeze and honest failed-goal release gate. Composio discovery returned 401; existing authenticated GitHub/Vercel tools were used. Only feat/phase-5 was pushed, no main push.
- New/updated files include scripts/{diagnose-dev,research-holdout}.ts; lib/{pill-views,flip-store,research-safety,research-holdout-results}.ts and tests; ai cleanup/prompt/reader; check API/flow/photo service/input; result view; research page/charts; data/report/interpretation/README; screenshots. Original phase-4 artifacts are preserved.

HOW TO TEST / CURRENT STATE / NEEDS VEDHANTH
- Run npm test, npm run lint, npx tsc --noEmit, npm run build. Cached reproduction: env -u ANTHROPIC_API_KEY node --import tsx scripts/research-holdout.ts. It enforces frozen source/cohort hashes and does not pay again. The manually written post-run interpretation is separate so cached report regeneration cannot erase it.
- Preview Ready: https://second-look-git-feat-phase-5-vedhanth.vercel.app/research (verified immutable deployment https://second-look-adc9zr4l1-vedhanth.vercel.app , dpl_13EEgiwXjTYNwrg224pZA8iZT4dG). Browser checks repeated on the deployed preview at 375/1440 PASS: research page, flip/skip/continuation-only second view, both photos, no overflow/runtime errors; AI mocked. Real preview API expired continuation -> HTTP 410 PASS, with no AI call. Full live AI label/photo/flip end-to-end NOT RUN; do not claim it was.
- Branch report, interpretation, CSV, results and freeze links all return HTTP 200. Verified production /research is still phase 4 and GitHub main remains 1e8ff969c88fd4b09b5357fee6ea876290d132b6. Git working tree is on feat/phase-5; implementation remains byte-identical to frozen 7cb343a paths. README now clearly marks this branch preview-only and provides branch-correct audit links.
- Preview caveat: frozen research-page buttons target GitHub main, which deliberately still holds phase 4, so the new report/CSV should be opened using the feature-branch links instead: https://github.com/Vedu-2011/second-look/blob/feat/phase-5/research/REPORT.md and https://github.com/Vedu-2011/second-look/blob/feat/phase-5/research/out/holdout-pairs.csv . No post-holdout source edit was made just to alter these links. They resolve to the new artifacts if the branch is later explicitly approved for main.
- Planner has not been contacted; real bottle-photo sample folders remain empty.
- Need architect direction: accept an honest but failed-goal feature release, or use this evidence as development and plan another bounded cycle with a NEW untouched holdout and budget. No further tuning or paid readings in this phase without direction.

## 2026-11-10 — Phase 4: NIH consumer-photo benchmark — prompts/phase-4.md

BUILDER: Codex
HANDOFF — Phase 4
STATUS: DONE — implemented, reviewed, committed, pushed to main, and verified on production. Cached readings reused; no engine tuning.

WHAT I DID
- Resumed the uncommitted phase-4 work on `feat/phase-4-codex`. Reused every completed reading in `research/out`; the resumed run made zero paid model calls. Recomputed the report, CSV and source hashes with ANTHROPIC_API_KEY unset. The cost ledger SHA256 was identical before/after: `7967d045fb14c7ee4f421029265d042d0ece1ef64a66e241d7ff3425d0348ba2`.
- Added a seeded, auditable NIH consumer-photo benchmark: 200 photos, 100 distinct NDC products, 400 balanced pairs (200 right + 200 wrong). Of the wrong pairs, 168 are hard look-alikes and 32 easy negatives. Wrong labels must represent different generic medicines, not another manufacturer of the same drug. Hard pairs share FDA color and shape and have different, non-equivalent imprints.
- Ground truth uses our RxNav client with ndcstatus=ALL. Exact URLs, image hashes, exclusions, full recorded FDA product groups, model caches, raw baseline replies and token-cost ledger are committed; downloaded images and full index remain ignored.
- Built /research with three charts, all five method rows, visible abstention counts, the baseline tradeoff, limitations, and links to the report/CSV. Added footer, sources, home and README links/headline. No invented or rounded-up success rate.
- Preserved the planner's `prompts/phase-4.md` and `docs/TIMELINE.md` edits.

FINAL VERIFICATION METRICS
N = 200 images / 100 products / 400 pairs. Seed 20261109. Production prompt pill-v1.
Models: claude-sonnet-5-5 and claude-haiku-5-5. Direct-AI baseline uses Sonnet only.

| Method | Wrong caught / 200 | False alarms / 200 right | Right passed / 200 | Unsure / 400 | Wrong unsure / 200 | Easy caught / 32 | Hard caught / 168 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Sonnet pipeline | 77 (38.5%) | 2 (1%) | 64 (32%) | 257 | 123 | 10 | 67 |
| Sonnet, no folding | 77 (38.5%) | 2 (1%) | 64 (32%) | 257 | 123 | 10 | 67 |
| Haiku pipeline | 56 (28%) | 6 (3%) | 41 (20.5%) | 297 | 144 | 7 | 49 |
| Haiku, no folding | 56 (28%) | 6 (3%) | 41 (20.5%) | 297 | 144 | 7 | 49 |
| Direct Sonnet | 91 (45.5%) | 9 (4.5%) | 49 (24.5%) | 248 | 106 | 28 | 63 |

Every denominator retains UNSURE. The pipeline incorrectly passed zero wrong pairs in this cohort; direct AI incorrectly passed 3 hard wrong pairs. This is not a safety guarantee. The report also lists every easy/hard catch, abstention and incorrect pass.

| Reader (200 photos each) | Exact imprint | Close | Wrong | No read | Color agrees | Shape agrees | Reader errors |
|---|---:|---:|---:|---:|---:|---:|---:|
| Sonnet | 119 | 1 | 26 | 54 | 157 | 184 | 8 |
| Haiku | 94 | 0 | 56 | 50 | 147 | 178 | 15 |

SKIPS, SPEND AND TIME
- 32 candidate products skipped before model reading: 5 lacked an FDA imprint/product; 27 had no resolvable drug group. All are individually listed in DATA.md. 67 retained products are inactive/discontinued. All retained products have a single part in the NIH index.
- Total estimated spend = $6.6680584, including the failed initial baseline configuration. Hard cap $8. Sonnet reading averages 2.858 seconds and $0.010800 per new image/check; Haiku 3.809 seconds and $0.000764. Final direct baseline averages 1.436 seconds and $0.004862 per pair. One cached reading serves two benchmark pairs. Times exclude upload, label reading, FDA lookup, explanation and UI.
- The initial direct baseline used default adaptive thinking with max_tokens=128: 382/400 replies were nonconforming, including 381 empty replies. This was a configuration/output-budget failure, not a detection result. All 400 baseline pairs were rerun, without choosing by correctness, using `thinking.type=between_tools`, `output_config.effort=high`, max_tokens=128. Both versions remain in baseline.json and all spend is included. The final version has one nonconforming reply, counted UNSURE. Different reasoning settings mean this is a comparison of system configurations, not an isolated causal effect of deterministic code.

EXACT ENGINE CHANGES AND NO-TUNING AUDIT — requested explicitly by Vedhanth
1. `src/lib/match/imprint.ts`: added optional third parameter `fold = true` to compareImprint. Wrapped only the pre-existing confusable-character comparison in `fold && ...`. Exact matching, token normalization, stopwords, side-order handling and the confusable-character map were not changed.
2. `src/lib/verdict-engine.ts`: added optional fourth parameter `fold = true` to decide; added the same default to its private score helper; forwarded the flag into compareImprint and through scoring for the expected/reference product, exact label product, same-drug alternatives, and guess/identification candidates. No confidence thresholds, rankings, appearance rules, verdict conditions, source handling or reason wording changed.
3. Why: expose the required folding-off ablation without forking the engine. Every production caller omits the flag, so production remains folding-on.
4. Independently extracted the original engine and imprint matcher from pre-phase HEAD `ff4ea86`, evaluated original versus current default-on implementations on all 400 pairs for both cached models, and deep-compared the full EngineResult objects: PASS, 800/800 identical, including verdicts, reasons and feature rows. Temporary comparison files were then removed. No model calls were made.
5. NO engine tuning, threshold tuning, prompt tuning or schema tuning was performed on these photos. The existing production readers/prompts/schemas are unchanged. This cohort was used only for evaluation; no photo was removed because its answer was poor. Baseline configuration repair above is disclosed, not hidden. Pair-rule hardening excludes equivalent imprints; an audit found zero changes to the selected pairs. Reporting-only changes add easy/hard abstentions and incorrect passes.
6. If any future reader/matcher change is developed using this cohort, treat these photos as development data. Sample a disjoint, never-tuned-on cohort for the final performance numbers; do not reuse these results as a fresh holdout.

PROBLEMS / WHAT THE NUMBERS ACTUALLY SAY
- The Sonnet pipeline catches only 38.5% of wrong pairs and passes only 32% of right pairs. Its 257/400 abstentions are a serious usability limitation. Direct AI catches more wrong pills (45.5%) but has more false alarms (4.5% versus 1%); do not claim an overall accuracy win for “code decides.”
- Haiku is cheaper but weaker on this test; its mean observed reading latency is also slower. Folding produced no verification-outcome benefit on this cohort. Do not invent an ablation gain.
- Production validation rejected some overlong imprint/shape/form strings, even after the normal retry; those failures stay in the denominators as no-read/UNSURE. Single views can hide the imprint. Blank-side photos remain included.
- Limits: 2016-era public NIH archive; changed/discontinued product records; controlled single-pill backgrounds; no size measurement; known label NDC rather than label OCR; correlated observations (two photos/product, two pairs/photo); possible model-training overlap. This is an engineering benchmark, not independent clinical validation or errors prevented.
- Suggested improvements, not implemented here: tighter transcription instructions/schema descriptions, crop and lighting guidance, and optional second-side capture. Develop separately and evaluate on a fresh held-out set.

FILES CREATED / CHANGED
- New: `scripts/research.ts`; `src/lib/research{,-budget,-results}.ts`; `src/lib/research.test.ts`; `src/app/research/page.tsx`; `src/components/research-charts.tsx`.
- New research artifacts: `research/{DATA,REPORT}.md`, `research/out/{cohort,results,cost,baseline,readings-claude-sonnet-5-5,readings-claude-haiku-5-5}.json`, `research/out/pairs.csv`.
- Updated: engine/matcher ONLY as listed above; home/sources/footer/README links; package files (+Recharts/research command); .gitignore. Screenshots in `docs/screenshots/phase-4/`.

TESTS / REVIEW
- Final resumed checks, repeated after the chart-margin fix: PASS 142 tests / 22 files; lint, TypeScript and production build PASS. Only the two existing non-fatal Atkinson font override warnings.
- Original-engine equivalence audit: PASS 800/800 full results; no production drift.
- Cached reproduction with ANTHROPIC_API_KEY unset: PASS, zero paid calls; cost ledger unchanged.
- Earlier review findings fixed: incomplete result publication guard; explicit baseline reasoning configuration; conservative token-count/in-flight budget reservations in place of flat $0.10; equivalent-imprint negative exclusion; explicit unfavorable results/abstentions. Latest Codex review asked for artifact regeneration after source changes: fixed by cached regeneration, without new readings. Final source hashes must match committed implementation.
- Final independent CSV/JSON audit: PASS, all 2,000 rows / five methods, balanced truth, 100 distinct product codes, hard-negative metadata, exact source hashes and cost-ledger totals agree. No downloaded NIH images are tracked.
- Impeccable visual review found clipped percentage-axis labels; changed only the chart's left margin from -20 to 0. Research/home screenshots refreshed at 375 and 1440. Browser checks PASS: three charts, correct headline, no runtime errors, no clipped axis labels and no page-width overflow at both widths.
- Separate final Codex self-review of the full phase diff and reporting/axis follow-ups: no remaining blocking findings. The source-hash review finding is verified fixed, not merely documented. GitHub destination verified as public Vedu-2011/second-look, default branch main. Composio discovery returned 401, so existing authenticated GitHub/Vercel tools are used instead.

HOW TO TEST / CURRENT STATE
- PASS — https://getsecondlook.vercel.app/research at 375 and 1440: HTTP 200; 200-image / 400-pair headline, three charts, direct-AI tradeoff, wrong-pill abstentions, no runtime errors, no clipped axes or horizontal overflow. All five methods, report/CSV links and limitations are visible.
- PASS — production home, /sources, /check, /type and /samples return HTTP 200 and include the research link. GitHub REPORT.md, out/pairs.csv and out/results.json return HTTP 200; public results match the verified local run (200 photos, Sonnet 77 catches, total $6.6680584).
- PASS — cached reproduction with ANTHROPIC_API_KEY unset; unchanged cost.json. Run `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` for code checks; `env -u ANTHROPIC_API_KEY node --import tsx scripts/research.ts` for the already-cached local reproduction without loading .env.local. A fresh clone restores the fixed image cohort from NIH, verifies image hashes, and reuses the committed readings.
- Feature branch feat/phase-4-codex and main pushed through implementation commit e1a8ed4 (earlier phase commits 963c029 and 7edb5e4). Main push is explicitly authorized by prompts/phase-4.md. Vercel production deployment `second-look-hu04q5ptk-vedhanth.vercel.app` / `dpl_7ryJ6yKLheYqPgQaoybbYa3fJAaq` is Ready and aliased to getsecondlook.vercel.app. This final handoff update is documentation-only; production code was verified at e1a8ed4.
- Planner has NOT been contacted. Real bottle-photo sample folders remain empty; phase 3's recorded examples are unchanged.

OPEN QUESTIONS / SUGGESTED NEXT STEP
- Phase 5 accessibility/demo polish; present the research as an honest tradeoff and uncertainty result. Any accuracy improvement needs a separate development set plus a fresh final holdout. Vedhanth still needs to supply real bottle photos for samples.

## 2026-11-09 9:20 PM PST — Phase 3: labels, samples pipeline, public typed checks — prompts/phase-3.md

BUILDER: Codex
HANDOFF — Phase 3
STATUS: DONE — implemented, reviewed, pushed to main, and verified on production. Phone-photo sample content is pending; all three photo folders are empty, so their recorded FDA examples remain in use.

WHAT I DID
- Committed the four planner files first in `54fb5f3` (“Planner docs”), then built on `feat/phase-3-codex`. Phase-3 task 7 explicitly authorizes the main push after review.
- Added noindex `/labels`: three fictional Maple Street Pharmacy / Alex Rivera labels, each 3.5 × 2 inches, on one US Letter print page. All printed fields accept shared query parameters and per-bottle overrides such as `different-maker.ndc`. Dates default to 11/09/2026; editable via `date`. Labels include the demo disclaimer.
- Added `test-images/real/{match,different-maker,mismatch}/README.md`, `npm run samples:build`, EXIF orientation/removal, 1600px JPEG output through sharp, versioned public image paths, and atomic per-sample JSON saves. Empty folders retain prior samples; incomplete pairs or failed/early reads fail without replacing the old result.
- Extracted `runPhotoCheck` so `/api/check` and the sample builder use exactly the same readers, FDA engine, and guarded explanation. Sample pages prefer real saved photos/results when present. Every sample has “Run this check live,” live streamed progress, and saved-result fallback. With no photos it clearly explains that it is showing the recorded FDA example instead of pretending to run AI.
- Added public `/type`, linked from home and `/check`, with NDC/name modes, big inputs, two imprint sides, an uncertainty choice, FDA color/shape chips, and the shared ResultView. `/dev/check` redirects to `/type`; its obsolete form was removed. For typed pills, a small recorded FDA index supplies a possible drug lead only on an exact imprint; the live engine still verifies it before identification. L484 now works without asking a user to guess acetaminophen.
- Polished mobile verdict wrapping, the home sample entry point, typed-result wording, GitHub footer, and `/sources` with live deduplicated product counts and UTC load time (24-hour cache disclosed). Updated the wrong-pill saved example to use the same orange-oval ibuprofen NDC as its printable label. Replaced the starter README with the product, citations, pipeline diagram, setup, demo instructions, 131-test count, and limits.

FILES CREATED / CHANGED
- New: `src/app/{labels,type}/`, `src/lib/{demo-labels,typed-check,recorded-lead,photo-check,samples,samples-build}.ts`, `src/lib/sample-results/{match,different-maker,mismatch}.json` (null until real photos exist), `src/components/sample-check.tsx`, `scripts/build-samples.ts`, three test files, photo-folder READMEs.
- Updated APIs, sample/home/check/source pages, shared verdict/result/footer components, scenario fixtures, package files (+sharp), README. Screenshots: 10 before + 22 after images in `docs/screenshots/phase-3/`.

TESTS RUN
- `npm test`: PASS, 131 tests / 21 files (120 existing + 11 new). Covers label defaults/overrides, empty/failed/successful sample builds with mocked AI, typed modes/uncertainty/exact FDA leads; existing streamed-route tests stay green.
- TypeScript, lint, production build: PASS. Only the two existing non-fatal Atkinson font override warnings.
- `npm run samples:build`: PASS, all three folders empty, all three saved FDA examples kept, no AI call made for absent photos.
- Browser at 375 and 1440: NDC 0113-0517 + I2/orange/oval → MATCH; L484/white/oval → MISMATCH with Acetaminophen 500 mg identified; sample live entry without photos → calm saved-result note; “Same medicine” headline fits; `/dev/check` → `/type`.
- Chrome print check: three labels exactly 336 × 192 CSS pixels (3.5 × 2 inches), no clipped default text, one US Letter PDF page; global and per-scenario NDC query overrides PASS.
- All public page text scanned for “preview”, “coming soon”, and “dev”: none. Built HTML scan for the old unfinished copy: no matches. Final pages have no horizontal overflow at 375 or 1440.
- Live `/sources`: ibuprofen 200 mg 507 products (426 active), acetaminophen 500 mg 546 products (428 active), loaded from RxNav via shared cache.
- `npm run smoke:ai` LIVE regression after pipeline extraction: readers MISMATCH in 8,072 ms; full HTTP check MISMATCH in 7,969 ms, all streamed steps, share page HTTP 200. Estimated direct-reader/explanation usage $0.022273; separate HTTP call excluded from estimate.

REVIEW / DECISIONS
- Separate `codex review --uncommitted`: no discrete actionable correctness bugs. Follow-up self-review fixed a mobile home min-content overflow, ensured generated JSON literal types work once photos are recorded, keyed sample state by bottle, and removed misleading photo wording from drawn typed results. No design was invented for missing real photos. Impeccable helped preserve the existing pharmacy materials, readable form controls, spacing, and responsive verdict hierarchy; docs/DESIGN.md remained the design source.

EXACT REAL-PHOTO STATUS / NEEDS VEDHANTH
- match: NO `label.jpg` or `pill.jpg`.
- different-maker: NO `label.jpg` or `pill.jpg`.
- mismatch: NO `label.jpg` or `pill.jpg`.
- No user bottle photos were fabricated, substituted, or published. Real-photo sample replay/AI-down fallback cannot be proven end-to-end for these exact bottles until photos exist; mocked pipeline tests and the separate NIH live regression pass.

HOW TO TEST / NEXT STEP
1. Print `/labels` at 100%, US Letter, browser headers/footers off; `?ndc=...` changes all labels, `?match.ndc=...` changes just the matching bottle.
2. `/type`: NDC 0113-0517; I2/orange/oval → Matches. Change to L484/white/oval → Doesn't match and acetaminophen identification.
3. `/samples/different-maker?live=1`: recorded example and honest fallback note until its photos exist. Add the two photos per folder README, run `npm run samples:build`, review printed verdicts, then commit generated public photos/JSON and deploy.
4. Production at https://getsecondlook.vercel.app is live from reviewed code commit `855d21f`; deployment https://second-look-ey05b4fn9-vedhanth.vercel.app reached Ready. Production browser checks PASS at 375 + 1440: typed MATCH, identified L484 MISMATCH, sample saved fallback, headline fit, `/dev/check` redirect, editable labels, and exactly three 3.5 × 2 inch labels on one print page. The print harness was corrected to wait for streamed labels to become visible before measuring. All public pages have no unfinished copy or mobile horizontal overflow. Production live photo regression: HTTP 200, MISMATCH in 7,473 ms, eight working/done step events, saved share page HTTP 200. Exact user demo-photo scenarios remain untested because their folders are empty. Planner was not contacted.

## 2026-11-09 9:05 PM PST — Merge phase 2 to production — chat

BUILDER: Codex
HANDOFF — Merge authorized by Vedhanth's “merge”
STATUS: DONE — merge and production deployment verified. Exact three-pill demo photo coverage remains a phase-2 limitation described below.

WHAT I DID / FILES
- Fast-forwarded main from c48711e to the reviewed phase-2 branch at f698d9f and pushed main. Preserved all uncommitted planner files, including prompts/phase-3.md. This entry is the only new file change for the merge task.
- Production deployment https://second-look-a9vcygzhe-vedhanth.vercel.app reached Ready and is aliased to https://getsecondlook.vercel.app.

TESTS / REVIEW
- Existing phase-2 tests, lint, types, build, live preview checks, and independent Codex review passed before merge; no executable code changed during the merge.
- On production: /check HTTP 200; real fictional ibuprofen label + NIH Strattera photo through /api/check HTTP 200, all four streamed steps completed, MISMATCH in 7,762 ms; the saved result page returned HTTP 200.
- Reviewed this handoff-only diff separately before pushing; no findings.

CURRENT STATE / NEXT STEP
- Phase 2 is deployed to production. The merge task is complete. Exact I2/L484/Advil uploaded-photo scenarios still need the corresponding photos; their verification is not claimed here.
- Planner was not contacted. Continue with the next phase only when requested.

## 2026-11-09 8:54 PM PST — Phase 2 live follow-up — prompts/phase-2.md

BUILDER: Codex
HANDOFF — Phase 2 live AI and browser verification — Mon Nov 9, 2026
STATUS: PARTIAL — the photo flow is live and verified locally, but the three exact demo pill photos are unavailable, and production remains on phase 1 until Vedhanth authorizes merging the feature branch.

WHAT I DID
- Added `ANTHROPIC_API_KEY` as a Vercel environment variable for Production, Preview, and Development, and pulled it into ignored `.env.local`. The value is not recorded here or committed. The key was shared in chat, so Vedhanth should rotate it after this build.
- Confirmed Anthropic lists both configured model IDs. Sonnet 5.5 does not support forced tool choice, so the label/pill readers now use automatic tool choice and still require/validate a tool response. The first live readers worked.
- Made `npm run smoke:ai` load local development variables, measure token usage and estimated list-price cost, and exercise the real `/api/check` HTTP route plus `/result/[id]`. Malformed explanation JSON now falls back to the safe template.
- Captured real browser outcomes at 375px and 1440px: an ibuprofen label with a real, different Strattera pill photo gives MISMATCH; a blank pill photo gives the friendly no-pill retake. No simulated verdict was used for these screenshots, and neither size overflowed horizontally.

FILES
- `src/lib/ai/client.ts`, `src/lib/ai/explain.ts`, `scripts/smoke-ai.ts`, `package.json`, and four PNGs in `docs/screenshots/phase-2/`.
- Planner-owned `AGENTS.md`, `docs/ARCHITECTURE.md`, and `prompts/phase-2.md` are still uncommitted and untouched by this follow-up.

TESTS
- `npm test`: 120/120 pass; `npx tsc --noEmit --incremental false`: pass; `npm run lint`: pass; `npm run build`: pass (two non-fatal Atkinson font override warnings).
- `npm run smoke:ai` LIVE: Sonnet 5.5 and Haiku 5.5 available. The made-up label was read as ibuprofen 200 mg, NDC 0113-0517. The NIH Strattera photo was read as a capsule with “Lilly 3227 10 mg.” Direct readers + FDA engine: MISMATCH in 8,102 ms. Token usage: Sonnet 1,778 in/297 out and 5,836 in/378 out; Haiku 449 in/500 out; estimated $0.022273 at Anthropic list prices (Sonnet $2/$10 and Haiku $0.10/$0.50 per million input/output tokens; source: https://www.anthropic.com/claude-haiku-5-5). This estimate excludes the separate full-route invocation.
- Full `/api/check` HTTP check: streamed label and pill readings, FDA lookup and comparison steps in order; final MISMATCH in 10,691 ms, with route AI timing 10,229 ms. The share page returned HTTP 200. Blank-pill check returned a specific retake message.
- Vercel preview `https://second-look-p0logfkor-vedhanth.vercel.app` built Ready from `cdf1413`. `/check` returned HTTP 200. A second, live preview `/api/check` with the fictional ibuprofen label and real Strattera photo streamed all four steps, returned MISMATCH in 7,634 ms, and its share page returned HTTP 200. This verifies the Preview key; Production was not changed.

CODE REVIEW / PUSH
- `codex review --commit cdf1413`: no clearly actionable correctness bug. Pushed the reviewed `feat/phase-2-codex` branch; main was not merged or pushed.

PROBLEMS / DECISIONS
- The NIH source did not supply exact I2, L484, or Advil demo photos. Therefore MATCH, SAME_MEDICINE_DIFFERENT_MAKER, and the specified acetaminophen identification are not proven with real uploaded photos; do not claim them done. Deterministic engine scenarios remain covered by phase-1 tests.
- The provided key was sent in chat. Rotate it when convenient, then update the same Vercel variables and local `.env.local`.
- The smoke script uses Anthropic's current list prices and reports an estimate, not a billing statement.

CURRENT STATE / NEEDS VEDHANTH / NEXT STEP
- Branch: `feat/phase-2-codex`. Do not merge or deploy to production without Vedhanth's explicit “merge.” Obtain exact demo pill images or user photos, verify the three requested verdicts on preview, then request the merge gate. Vedhanth has not told the planner “handoffs”; no planner message was sent.

## 2026-11-09 8:40 PM PST — Phase 2: AI photo reading and real /check flow — prompts/phase-2.md

BUILDER: Codex
HANDOFF — Phase 2 (AI photo reading → deterministic FDA verdict) — Mon Nov 9, 2026
STATUS: PARTIAL — implementation and local verification are complete; live AI and production photo verification need `ANTHROPIC_API_KEY` from Vedhanth.

WHAT I DID
- Added the server-only Anthropic SDK client with env-configurable vision/text models, strict forced-tool readers, one retry, zod validation, and versioned label/pill prompts. The label prompt explicitly excludes patient names; the pill guess is a lead only.
- Replaced the fake `/check` progress state with the real two-photo flow: client-side EXIF-aware resize to a 1600px long edge, JPEG quality 0.85, friendly unsupported/oversize errors, streamed NDJSON progress, AI reading chips, early retake exits, the user's pill photo in ResultView, explanation and “Copy what to say,” plus a shareable result link.
- Added `/api/check`, a seven-day `sl:result:<id>` Redis result store, `/result/[id]`, per-IP 30/hour protection, and the `DAILY_CHECK_CAP` default of 500 with a Redis-outage fallback cap.
- Added three fictional Maple Street Pharmacy label fixtures rendered to PNG, two NIH/NLM consumer-grade reference photos, and source notes. The NIH directory did not contain exact I2, L484, or Advil demo photos, so those were not fabricated or mislabeled.
- Added the explanation safety guard and tests for invented drug names (including lowercase), numbers, dosing/medical advice, schemas, early exits, NDJSON ordering, rate limits, and result persistence.

FILES CREATED/CHANGED
- New: `src/lib/ai/`, `src/app/api/check/`, `src/app/result/[id]/`, `src/lib/check-input.ts`, `src/lib/rate-limit.ts`, `src/lib/result-store.ts`, `src/components/copy-script.tsx`, `scripts/smoke-ai.ts`, `test-images/`, `PRODUCT.md`.
- Changed: `src/app/check/check-flow.tsx`, `src/components/result-view.tsx`, `src/lib/verdict-engine.ts`, `package.json` and lockfile.
- Planner-owned `AGENTS.md`, `docs/ARCHITECTURE.md`, and `prompts/phase-2.md` remain preserved and are not included in the implementation commit.

TESTS RUN
- `npx tsc --noEmit --incremental false`: PASS.
- `npm test`: PASS — 18 files, 120 tests.
- `npm run lint`: PASS.
- `npm run build`: PASS. Next reports the expected Atkinson font override warnings; no build failure.
- `npm run smoke:fda`: PASS — cold MATCH 3196ms, SAME_MEDICINE_DIFFERENT_MAKER 409ms, MISMATCH 1612ms; warm 1–14ms. All three still use the real FDA fixtures/live APIs.
- `npm run smoke:ai`: NOT RUN LIVE — safely prints `SKIPPED: ANTHROPIC_API_KEY is not set`.
- Browser screenshot harness: NOT SAVED — hydration/navigation was unstable in the imported dev harness, so no phase-2 screenshot is claimed.

CODE REVIEW
- Codex review found eight real issues across three passes, all fixed: explanation-name checks were case-sensitive/lowered incorrectly; Redis fallback omitted the global daily cap; oversized JSON could exceed the deployment body limit; malformed/rejected requests could consume quota; Redis hourly rejection could still increment the daily counter; local result fallback entries outlived seven days; the streamed route had no explicit runtime budget; and the local fallback incremented daily quota before checking its hourly limit. Regression tests and a final local verification pass are green.

CURRENT STATE OF THE APP
- The feature branch is `feat/phase-2-codex`; production remains the phase-1 deployment until the key is supplied and this branch is intentionally merged/pushed according to the planner’s gate.
- With `ANTHROPIC_API_KEY`, `VISION_MODEL` (default `claude-sonnet-5-5`), and `TEXT_MODEL` (default `claude-haiku-5-5`), `/api/check` calls the same importable `readLabel`/`readPill` functions that phase 4 can evaluate. Without the key, it returns a friendly configuration error and never exposes a secret.

NEEDS VEDHANTH
- Provide `ANTHROPIC_API_KEY` so it can be added to Vercel production/preview/development and `.env.local` without appearing in code, logs, or this handoff.
- After the key is present, run `npm run smoke:ai`, capture the three real photo flows plus UNSURE retake screenshots at 375px and 1440px, then verify the preview/production `/check` flow.

OPEN QUESTIONS FOR THE PLANNER
- Keep `/dev/check` noindex until the planned phase 3 public “type what’s on your pill” feature.
- The NIH directory source gap is documented; phase 4 should use the exact available benchmark inventory rather than infer missing demo-pill photos.

SUGGESTED NEXT STEP
Supply the Anthropic key, run the live smoke and screenshot checklist, then have the planner decide whether to merge this feature branch.

## 2026-11-09 1:45 PM PST — Phase 1: FDA data layer, matcher, verdict engine, ResultView — prompts/phase-1.md

HANDOFF — Phase 1 (real FDA data → verdict, no AI yet) — Mon Nov 9, 2026, 1:45 PM PST
STATUS: DONE — commit 9ca21d2 on main, live on production, every How-to-test item verified there (bottom).

LINKS
- Dev check (noindex, not in nav): https://getsecondlook.vercel.app/dev/check — 3 prefill buttons auto-run.
- Samples (real engine on recorded FDA data): https://getsecondlook.vercel.app/samples and /samples/{match,different-maker,mismatch}
- APIs: GET /api/lookup?ndc=0573-0160 · GET /api/lookup?q=ibuprofen 200 mg · POST /api/verify
- Vercel ↔ GitHub: `vercel git connect` done → every push to main auto-deploys production.

WHAT I DID
- FDA clients (src/lib/fda/): fetchJson with 8 s timeout + one retry on timeout / network / 5xx / 429 and friendly
  error text (never a raw error). `cached()` = memory (300 entries) → Redis `sl:fda:<url>` (24 h) → fetch; Redis
  errors are ignored so FDA still works if Redis is down. We cache the SLIM parsed product list, not raw JSON
  (ibuprofen 200 mg raw RxNav = 1.2 MB, over Upstash's 1 MB value limit).
- NDC parsing (ndc.ts): 4-4-2, 5-3-2, 5-4-1, 5-4-2 dashed, product-only (4-4/5-3/5-4), undashed 11/10/9/8 digits,
  "NDC" prefix, spaces, en dashes. A bare 10-digit NDC is tried all three ways and only accepted if exactly ONE
  is a real product (Codex finding); if two are real we say so and fall back to the drug name.
- RxNorm: label NDC → product (ndcproperties, ndcstatus=ALL so discontinued ones are found). Drug name → concept
  via approximateTerm. "Same drug" = the generic SCD + every brand SBD of it (Advil 153008 → related SCD 310965 →
  its 8 SBDs), all products merged and deduped by product code = 507 ibuprofen 200 mg tablets live today.
- DailyMed v2 (dailymed.ts): label title + published date per setid; labels that were taken down fall back to
  spls/<setid>/history.json.
- Matcher (src/lib/match/): imprint (descriptor stoplist, look-alike folding 0/O 1/I/L 5/S 8/B 2/Z 6/G = "close",
  side order ignored, one visible side = partial), color (12 FDA colors + off-white/beige, synonyms, close pairs,
  half of a two-tone = close), shape (synonyms; oval/capsule/oblong/rectangle are close).
- Verdict engine (src/lib/verdict-engine.ts, pure, no network): AI-reads-code-decides. Thresholds imprint 0.7,
  color 0.5, shape 0.5. Order: no FDA data → UNSURE; no imprint → UNSURE ("try the other side"); label product
  imprint matches → MATCH (UNSURE if low confidence or the color/shape is different, with the reason); another
  maker's version matches → SAME_MEDICINE_DIFFERENT_MAKER (MATCH when the label had no NDC); nothing matches →
  MISMATCH, and we name the pill ONLY from an exact imprint match in the guessed drug's FDA products. Prefers
  products still made; says "no longer made" when the only match is discontinued. Size is always "Not measured",
  never pass/fail. Every reason is plain English and every verdict carries DailyMed + RxNorm evidence links.
- check-service.ts runCheck (NDC → drug group → decide → guess group on MISMATCH → DailyMed meta) with timings.
- /api/verify (zod; 400 with a plain message, 502 with friendly FDA message), /api/lookup (ndc or q; garbage NDC →
  400 "That doesn't look like an NDC…", unknown → 404, ambiguous → 400 "type it with the dashes").
- ResultView (src/components/result-view.tsx): verdict field with plain instruction → side-by-side "What the FDA
  says it should look like" vs "What's in your bottle" drawn to the same scale → "Why it looks different" strip
  (same medicine) or "This imprint belongs to" card (mismatch) → Feature by feature table → Why we said this →
  Where this comes from (DailyMed badges by role + RxNorm "507 products compared" + checked date).
- /samples rewritten: each card's verdict, drawings and instruction now come from the real engine run on RECORDED
  FDA data (no network at build, works if FDA is down during judging). New /samples/[id] shows the full ResultView.
- /dev/check: typed label + pill readings, 3 prefills (auto-submit), shows the ResultView and "Answered in N ms".
- CheckingSteps step 4 → "Comparing with FDA records".
- Fixtures: scripts/record-fda-fixtures.mjs saves trimmed real RxNav JSON (rxcui 310965, 198440, NDC 0113-0517,
  0573-0160, concept/related lookups, approximateTerm) + DailyMed meta into src/lib/fda/__fixtures__ (~800 KB,
  recorded Nov 9, 2026; index.json lists every source URL).

FILES CREATED/CHANGED
New: src/lib/fda/{ndc,http,cache,types,concept,rxnav-parse,rxnav,dailymed-parse,dailymed,recorded}.ts,
src/lib/fda/__fixtures__/*.json (15), src/lib/match/{imprint,color,shape,reading}.ts, src/lib/{verdict-engine,
check-service,verify-schema,demo-scenarios,sample-results}.ts, src/app/api/{lookup,verify}/route.ts,
src/app/dev/check/{page,dev-check-form}.tsx, src/app/samples/[id]/page.tsx, src/components/result-view.tsx,
scripts/{smoke-fda.ts,record-fda-fixtures.mjs}, docs/screenshots/phase-1/*.png (14).
Tests: src/lib/fda/{ndc,parse,http-cache,rxnav}.test.ts, src/lib/match/{imprint,color-shape}.test.ts,
src/lib/{verdict-engine,verify-schema,check-service}.test.ts.
Changed: src/app/samples/page.tsx, src/components/{checking-steps,feature-table,source-badge}.tsx, src/lib/verdict.ts
(FeatureResult gains "not_measured"), package.json (+zod, +tsx, `npm run smoke:fda`). docs/ARCHITECTURE.md has the
planner's "Decisions after phase 0" section (committed as-is, not edited by me).

TESTS RUN
- vitest: 108/108 PASS, 12 files, no network (77 new). Covers every NDC layout + garbage, imprint (I-2/i 2,
  stoplist, "12"≈I2, "1484"≈L484, side order, partial, display drops descriptors), color/shape, RxNav parsing
  (dedupe, packed two-tone, SCORE, active/discontinued), the 3 demo verdicts on recorded data, "12" → MATCH,
  imprintConfidence 0.4 → UNSURE, color "white" → UNSURE with "color doesn't match" reason, wrong shape → UNSURE,
  no imprint, label not found, size never pass/fail, discontinued "no longer made", mismatch without guess →
  identifiedAs null, letters-only never gives a yes (no FDA color / unreadable color → UNSURE), look-alike imprint never names a pill, NDC not found / ambiguous, zod messages, fetch retry /
  timeout / 404 / bad JSON, cache, and runCheck end-to-end with fetch stubbed to serve the fixtures.
- tsc PASS, eslint PASS (0 warnings), next build PASS.
- npm run smoke:fda (LIVE RxNav + DailyMed, memory cache only, so "cold" = real network):
```
== cold ==
PASS match            MATCH                           1794 ms  (label 600, drug 763, guess 0, dailymed 430)  compared 507  → Ibuprofen 200 mg · L. Perrigo Company · NDC 0113-0517
PASS different-maker  SAME_MEDICINE_DIFFERENT_MAKER    332 ms  (label 161, drug 78, guess 0, dailymed 90)  compared 507  → Ibuprofen 200 mg · L. Perrigo Company · NDC 0113-0517
     - Your label lists Advil (ibuprofen 200 mg) made by Haleon US Holdings LLC. Your pill matches the FDA record for the version made by L. Perrigo Company: same medicine, same strength.
PASS mismatch         MISMATCH                        1148 ms  (label 99, drug 0, guess 718, dailymed 327)  compared 507  → Acetaminophen 500 mg · L. Perrigo Company · NDC 0113-0484
     - No Ibuprofen 200 mg the FDA lists has "L484" on it. We checked 507 products from every maker.
     - "L484" is on Acetaminophen 500 mg made by L. Perrigo Company (FDA record).
== warm ==
PASS match 0 ms · PASS different-maker 5 ms · PASS mismatch 12 ms
```
  (cold runs share warm-up: scenario 2 reuses the ibuprofen list scenario 1 fetched.)
- rxcui 310965 product list (469 generic products): cold from FDA 1165 ms, warm from Redis 217 ms, warm from
  memory 0 ms — all under 4 s. Redis has 32 keys `sl:fda:*`, 0 un-prefixed `fda:*` keys.
- Local API: /api/lookup?ndc=0573-0160 → Advil, Haleon, brown oval 15 mm, setId 1a665e64…; ?ndc=garbage → 400
  friendly; ?ndc=9999-9999 → 404 friendly.
- Screenshots (docs/screenshots/phase-1/, 375@2x + 1440, all "no horizontal overflow"): dev-check-{match,
  different-maker,mismatch}, samples, samples-{match,different-maker,mismatch}. I looked at them; layout holds at 375.
- Codex review: round 1 found 3 real issues, all fixed with tests: (P1) drug lookup forced "oral tablet" for every
  form → plain tablet/capsule get "oral …", other forms pass through as written; (P1) ambiguous undashed 10-digit
  NDC silently picked the first real product → now refuses to guess; (P2) descriptor words inside an imprint side
  were drawn as markings → filtered word by word. Round 2 found 1 more real issue,
  fixed with tests: (P1) "unknown" color/shape (FDA record has none, or a confident reading we can't parse) counted
  as agreeing, so letters alone could say MATCH → now UNSURE with a plain reason; readings we skip for LOW
  confidence are still ignored on purpose. Round 3: "No discrete, actionable bugs". Then committed + pushed.

PROBLEMS / FINDINGS (worth knowing for the deck and later phases)
- The most common look for ibuprofen 200 mg is NOT the orange oval. Among active products with full data:
  brown round I2 = 38, brown round "44 291" = 36, brown round G2 = 25, brown oval I2 = 18, orange oval I2 = 16.
  So a label with no NDC shows "Most common look: brown round I2" (true FDA data). The demo "wrong pill" sample
  therefore shows a brown round I2 on the label side. If you want the orange oval there, give that bottle an NDC.
- RxNav quirks: approximateTerm needs "oral tablet" in the term or it returns an ingredient-level concept;
  a bare 10-digit NDC isn't accepted (we convert); rows repeat per package (we dedupe); two-tone colors arrive
  packed as "C48325;C48331".
- The old NLM pill image API (pir.nlm.nih.gov) is dead; DailyMed v1 imprint search is gone. We use RxNav
  ndcproperties (imprint/color/shape/size come from SPL data) + DailyMed v2 for label metadata.
- /samples uses recorded generic-only data (469 products), so its RxNorm badge says "469 products compared";
  live checks include brand SBD products too (507). Both numbers are real; they differ only by brands.
- Next 16 dev flagged `params` read outside Suspense on /samples/[id]; fixed by moving the read into a Suspense
  child (the 3 sample pages are still fully prerendered).

DECISIONS I MADE
- Naming the wrong pill requires an EXACT imprint match in the guessed drug's FDA products; a look-alike ("1484")
  still says MISMATCH but doesn't claim what the pill is. Safer for a health app.
- Without an NDC we never say SAME_MEDICINE (nothing to compare the maker against): it's MATCH if any version of
  the medicine matches.
- Color/shape readings below their thresholds are ignored, not held against the pill. But a confident reading we
  can't compare (FDA lists no color/shape, unknown word) blocks a yes → UNSURE. Letters alone never say MATCH.
- A color or shape "different" with matching letters → UNSURE (not MISMATCH): letters are the strongest evidence.
- /dev/check is an internal tool: noindex, not linked. Remove or keep hidden before submission (planner's call).

CURRENT STATE OF THE APP
Production = this commit. /check still uses the fake phase-0 progress (no photo reading yet); /dev/check and
/samples show real FDA-backed verdicts; Redis caching live with sl: prefix.

NEEDS VEDHANTH
Nothing.

OPEN QUESTIONS FOR THE PLANNER
1. Demo "wrong pill" bottle: keep no NDC (label side shows the most common look = brown round I2), or put the
   orange-oval Perrigo NDC 0113-0517 on that label so both sides of the demo look like the other bottles?
2. Should /dev/check stay deployed for judges (it's a nice "type it yourself" tool) or be removed before submit?

SUGGESTED NEXT STEP
Phase 2: AI reading (label photo → LabelReading, pill photo → PillReading with confidences) feeding runCheck,
wired into /check with the real CheckingSteps timings.

PRODUCTION CHECKLIST (after deploy)
Run against https://getsecondlook.vercel.app after the auto-deploy of 9ca21d2:
1. Prefills give the right verdicts (API + the real buttons on /dev/check driven in Chrome at 375 and 1440): PASS
2. Imprint "12" → still MATCH; imprintConfidence 0.4 → UNSURE: PASS
3. Color "white" → UNSURE, reason "…but the color doesn't. That can mean a mix-up, or just a hard photo.": PASS
4. /api/lookup?ndc=0573-0160 → Advil (Haleon); ?ndc=garbage → friendly 400: PASS
5. Second identical request faster; keys start with "sl:": PASS (q=ibuprofen 200 mg: 278 ms then 98 ms, server 155
   → 0 ms; Redis has 32 sl:fda:* keys and 0 un-prefixed). /dev/check has robots noindex,nofollow.
```
1a match             200 MATCH                          977 ms  
1b different maker   200 SAME_MEDICINE_DIFFERENT_MAKER  125 ms  
1c mismatch          200 MISMATCH                       191 ms identifiedAs=Acetaminophen 500 mg (0113-0484) 
2a imprint 12        200 MATCH                          120 ms  
2b confidence 0.4    200 UNSURE                         96 ms  | We couldn't read the letters on the pill clearly enough to be sure (we think it says I2).
3 color white        200 UNSURE                         106 ms  | The letters match Ibuprofen 200 mg, but the color doesn't. That can mean a mix-up, or just a hard photo.
lookup ndc=0573-0160       200 Advil · Haleon US Holdings LLC · Brown Oval 115 ms
lookup ndc=garbage         400 That doesn't look like an NDC. It's usually 10 or 11 digits, like 0573-0160-17. 99 ms
lookup ndc=0573-0160       200 Advil · Haleon US Holdings LLC · Brown Oval 135 ms
lookup q=ibuprofen 200 mg #1 200 products=507 active=426 278 ms total, server ms=155 {"memoryHits":12,"redisHits":0,"misses":1}
lookup q=ibuprofen 200 mg #2 200 products=507 active=426 98 ms total, server ms=0 {"memoryHits":13,"redisHits":0,"misses":0}
dev-check-match-375.png ok | Matches / 
dev-check-different-maker-375.png ok | Same medicine / 
dev-check-mismatch-375.png ok | Doesn't match / 
dev-check-match-1440.png ok | Matches / 
dev-check-different-maker-1440.png ok | Same medicine / 
dev-check-mismatch-1440.png ok | Doesn't match /
```

## 2026-11-08 11:35 PM PST — Phase 0: skeleton, design system, live deploy — prompts/phase-0.md

HANDOFF — Phase 0 (skeleton, design system, drawn pill, pages, deploy) — Sun Nov 8, 2026, 11:35 PM PST
STATUS: DONE (one small thing needs Vedhanth: let Vercel see the new GitHub repo, see below)

LINKS
- Production: https://getsecondlook.vercel.app (public, no login). /api/health → {"ok":true,"redis":true,...}
  (second-look.vercel.app was taken; Vercel's auto alias second-look-tawny.vercel.app also works)
- Repo (public): https://github.com/Vedu-2011/second-look — branch main
- Vercel project: vedhanth/second-look. Preview test deploy (opens with no login):
  https://second-look-ox9r0dymy-vedhanth.vercel.app

WHAT I DID
- Scaffolded Next.js 16.4.5 (App Router, TS, Tailwind v4, src/) in a temp folder and moved it in; kept CLAUDE.md,
  HANDOFF.md, docs/, prompts/. Added vitest 5, shadcn/ui (base-nova) restyled to DESIGN.md, lucide icons, @upstash/redis.
  Note: create-next-app 16 turns on `cacheComponents` by default, so routes use `await connection()` instead of
  `export const dynamic` (the old config is a build error now).
- Design system: Atkinson Hyperlegible Next + Mono via next/font/google; all 7 DESIGN.md colors as CSS vars wired
  into Tailwind (bg-amber, text-ink, bg-match…); body 18px mobile / 20px desktop; radius hierarchy (photo/verdict 20,
  rows 12, buttons full); soft shadows, no hairline borders; visible 3px ink focus ring; reduced motion respected.
- src/lib/fda/codes.ts: all 12 FDA colors (C48323–C48334) and 19 shapes (C48335–C48353), verified against
  fda.gov SPL Color / SPL Shape pages (URLs in the file), plus our display hex per color.
- src/lib/fda/fixtures.ts: real records pulled live from RxNav + DailyMed today (I2 round, I2 oval, Advil oval,
  L484 acetaminophen, a two-tone omeprazole capsule for the capsule drawing), each with NDC, setid, published date,
  source URL.
- Components (src/components/): Button (+ButtonLink), StepIndicator, VerdictField (4 verdicts), FeatureTable,
  CheckingSteps (waiting/working/done/failed), SourceBadge, PillDrawing, site header/footer. Verdict wording lives
  in src/lib/verdict.ts (types phase 1 can reuse).
- PillDrawing: SVG built in millimetres from shape code + color codes + size, so pills sit side by side to scale.
  Round, oval, capsule, rectangle, square, diamond, triangle, 5–8-sided polygons; other shapes (bullet, tear,
  clover…) fall back to round and say so. Two-tone = split halves. Tablets get a debossed imprint, capsules a
  printed one. Highlight modes imprint/color/shape. Optional mm ruler. Pure math in src/lib/pill.ts.
- Pages: / (Flynn stat with PubMed link + a real drawn FDA pill card + Kesselheim line with PubMed link),
  /check (2-step label → pill capture, camera + upload, preview, retake, friendly non-image error, fake 4-step
  checking that ends with an honest "preview" note), /samples (3 cards: match / same medicine / mismatch with real
  FDA drawings, photo placeholders), /sources (DailyMed, RxNorm, NIH dataset — what/why/links, last checked),
  /style (every component, all 4 verdicts, 3 real pills to scale, highlights, every FDA shape, colors, type).
  Footer disclaimer on every page.
- /api/health writes a per-request Redis key, reads it back, deletes it.
- Vercel: linked, deployed to production, preview deployment protection turned OFF (ssoProtection = null, tested
  with a real preview URL → 200 without login).

FILES CREATED/CHANGED
src/app/{layout,page,globals.css}, src/app/{check/{page,check-flow},samples/page,sources/page,style/page}.tsx,
src/app/api/health/{route,route.test}.ts, src/components/{button,checking-steps,feature-table,pill-drawing,
site-chrome,source-badge,step-indicator,verdict-field}.tsx, src/components/ui/button.tsx,
src/lib/{pill,pill.test,redis,verdict}.ts, src/lib/fda/{codes,codes.test,fixtures}.ts, vitest.config.mts,
.env.example, .gitignore (allows .env.example), docs/screenshots/phase-0/*.png (16 files)

TESTS RUN
- vitest: 31/31 PASS (codes lookups + packed two-tone codes, pill geometry/fills/imprint/size helpers incl. every
  FDA shape, /api/health with Redis mocked: ok, not configured, wrong value, Redis down, two overlapping probes).
- eslint PASS, tsc PASS, next build PASS.
- Codex review of the phase commit: 2 findings, both real, both fixed (shared health key could false-fail under
  concurrent probes → per-request key; Advil 16 mm fixture is brown on one side/yellow on the other → switched,
  see decisions). I did not re-run Codex on the small fix commit.
- How-to-test checklist, run by me against PRODUCTION with headless Chrome at 375px:
  1. Home at 375 looks finished, Flynn link opens PubMed — PASS
  2. /check: upload → preview → step 2 (focus moves to new heading) → non-image file shows friendly error →
     pill photo → "Check my pill" → steps tick done,working… → all 4 done → "Check finished", 2 thumbnails — PASS
  3. /style: 4 verdicts readable; I2 round 10 mm, I2 oval 15 mm, Advil oval 15 mm drawn to the same scale — PASS
  4. /api/health → {"ok":true,"redis":true} on production, preview and local — PASS
  5. Keyboard: every control shows a 3px focus outline; reduced motion: spinner has no animation, steps still
     tick to done — PASS
- Screenshots 375 + 1440 of /, /check, /samples, /sources, /style + 3 check-flow states in
  docs/screenshots/phase-0/. No horizontal overflow on any page at either width.

PROBLEMS / DECISIONS I MADE
- Redis: a new Upstash database was refused (`no_eligible_plan`: the free plan is used by LineLess's database,
  only paid plans were offered). I did NOT buy one. I connected the existing LineLess Upstash database
  (upstash-kv-crimson-diamond) to this project instead — same KV_ env names — and every Second Look key goes
  through key() in src/lib/redis.ts with the prefix "sl:", so nothing collides with LineLess. If you'd rather have
  a separate database, Vedhanth has to pick a paid plan (or delete the old one) in the Vercel dashboard.
- GitHub → Vercel auto-deploy is NOT connected yet: `vercel git connect` failed because the Vercel GitHub app
  can't see the new repo (it's probably set to "selected repositories"). Production was deployed with the CLI.
- Advil: the 16 mm Advil oval (NDC 0573-0165) is "brown (one side is brown while the other side is yellow)" per
  the FDA record, so a solid brown drawing would be wrong. I used NDC 0573-0160 instead: same DailyMed label
  (setid 1a665e64…, published Nov 6, 2026), plain pinkish-brown oval, 15 mm, imprint "Advil".
- I2 round (NDC 0113-0074) is discontinued: RxNav marketing status COMPLETED, last DailyMed version Feb 24, 2025,
  and it's gone from the current DailyMed list (the drugInfo link still opens). Fine for /style; don't build a
  demo bottle on it. The I2 oval (0113-0517) is active.
- pir.nlm.nih.gov (the NIH challenge link in ARCHITECTURE.md) no longer resolves. The dataset is at
  https://data.lhncbc.nlm.nih.gov/public/Pills/index.html and the paper is Yaniv et al. 2016 (PubMed 29854569).
  /sources uses those.
- Data facts phase 1 needs: RxNav packs two-tone colors in ONE value ("C48325;C48331") — splitCodes() handles it.
  SCORE "1" means NOT scored (it's the number of pieces). Imprints can carry notes ("Advil;asymmetrical;underline",
  "082;IMPAX;20").
- Contrast: white on --match is 4.35:1 (passes only as large text), so all verdict text is bold and ≥ 20px.
  Primary buttons use ink text on amber (6.4:1); white on amber would fail.
- /check ends with "This is a preview of the checking screen. Real results are coming in the next version." and a
  link to /samples, so nobody mistakes the fake run for a result.
- Kesselheim numbers checked against the PubMed abstract: color aOR 1.34 (1.12–1.59), shape aOR 1.66 (1.43–1.94).

CURRENT STATE OF THE APP
Live, public, design-complete skeleton. No Anthropic calls. /check is UI only (fake timers). /samples shows real
FDA drawings with photo placeholders. Redis works in production.

NEEDS VEDHANTH
1. GitHub → Settings → Applications → Vercel → Configure → add the repo "second-look" (or "All repositories").
   Then tell me and I'll run `vercel git connect` so every push to main auto-deploys. (Until then I deploy by CLI.)
2. Optional: decide whether sharing the LineLess Redis is OK (it's free; a separate one costs money).

OPEN QUESTIONS FOR THE PLANNER
- Demo bottle 2 says "label with Advil's NDC": which Advil NDC will you print? 0573-0160 (plain brown 15 mm oval)
  is the clean one; 0573-0165 is two-colored.
- Want two-sided pills drawn (front + back, e.g. Advil brown/yellow faces) in phase 3, or is "Other side: …" text
  under the drawing enough?

SUGGESTED NEXT STEP
Phase 1 (FDA data layer + matcher + verdict engine). codes.ts, fixtures.ts, verdict.ts and the "sl:" Redis key
helper are ready to build on.


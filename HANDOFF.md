# HANDOFF log — newest entry on top
Claude Code adds a new entry at the top after every task (format in ~/Hackathons/CLAUDE.md).
The planner reads this file when Vedhanth says "handoffs". Never delete old entries.

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


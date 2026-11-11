# HANDOFF log — newest entry on top
Claude Code adds a new entry at the top after every task (format in ~/Hackathons/CLAUDE.md).
The planner reads this file when Vedhanth says "handoffs". Never delete old entries.

## 2026-11-10 8:17 PM PST — Whole-bottle check preview — prompts/phase-9.md

BUILDER: Codex
PREVIEW: https://second-look-git-feat-phase-9-bottle-vedhanth.vercel.app
EXAMPLE SHARED RESULT: https://second-look-git-feat-phase-9-bottle-vedhanth.vercel.app/result/4bc892d8-b703-4d76-a3a1-83233d491655
MODEL: GPT-6.1 Sol, High, via the explicitly authorized worker; parent Codex performed independent review, verification and deployment.
HANDOFF — Phase 9
STATUS: DONE — implementation and verification preview complete. NOT MERGED. Main/production remain 763b47f (phase 8 plus addendum 1). Awaiting Vedhanth's review of THIS preview and a new explicit “merge”.

WHAT I DID / FILES
- Added src/lib/bottle/segment.ts: Sharp raw pixels, EXIF orientation, ~1200px analysis, median Lab border color, Otsu distance threshold, morphology/hole filling, connected components, stable numbering and full-resolution padded crops. Rejects zero, over 20, varied background, edge/clutter/large blobs and suspicious touching shapes (including a neck test), with plain retake tips. Detection and cropping use no AI. Original decoded limit 32 MP.
- Added pure decide-bottle.ts plus check-bottle.ts orchestration. Label reading first, deterministic finding, at most five concurrent existing Sonnet readers, then the existing engine per pill. Resolve label FDA data once per bottle; coalesce repeated drug guesses and DailyMed lookups. Per-pill UNSURE remains UNSURE; confident appearance differences against the exact label NDC add a bottle WARNING. Any engine MISMATCH makes the bottle red. All MATCH/SAME_MEDICINE can be green, explicitly qualified as detected pills only. Any uncertainty prevents a green bottle.
- Added POST /api/check-bottle: bounded multipart upload, real NDJSON steps/progress, quota reservations before paid work/crop reads, friendly retake/errors and photo-free saved results. Weighted checks round UP: max(1, ceil(N/5)). Hourly and daily shared counters reserve atomically in Redis, always through sl: keys; configured-Redis failures now fail closed rather than bypassing the global cap. Initial one-unit reservation remains consumed for a failed/retake attempt. Existing one-pill capture UI, engine and matching rules are unchanged.
- Added /check mode selector and bottle-flow.tsx, bottle-result.tsx, upload.ts and overlay.ts. Photo numbers link/focus the matching row; rows show local mini crop, reading, verdict, actual FDA comparison and linked evidence. Corner badges preserve the photograph with 44px targets; reduced-motion selection uses instant scrolling. Retake keeps the label selection. User must inspect that every visible pill has a number; unseen/undetected pills are explicitly not checked.
- Full-size bottle pixels are retained while JPEG recompression bounds the actual request: bottle <=3,000,000 bytes, label <=700,000, total <=4,000,000. This respects the verified Vercel 4.5 MB platform limit; local file selection allows up to 12 MB/32 MP and asks for a simpler photograph if dimensions cannot be preserved within the upload cap. Source: https://vercel.com/docs/functions/limitations.
- Extended request-scoped AI usage callbacks/options without changing default one-pill models, prompts or cleaning. Added normalized-box bottle storage under sl:bottle-result:, seven-day expiry and nested field allow-listing. /result/[id] renders original positions on a neutral surface, no photo/crop. One-pill stored results remain compatible.
- Added development-only build-bottle-composites.ts, durable smoke ledger/cache and npm scripts bottle:composites / smoke:bottle. Updated README, DEVPOST What it does and a separate /research note. The research note explicitly excludes this feature from the frozen single-pill benchmark. Screenshot/audit/smoke evidence is under docs/screenshots/phase-9/.

FROZEN BEHAVIOR / MODEL / REVIEW
- Implementation commits: 52af40a, 7297f60, 4da0401, a4095a2; UI marker polish 6e22973. Requested model gpt-6.1-sol with reasoning_effort high was explicitly selected. Worker frozen/closed after checks. Parent docs/evidence commits are separate. No main push, merge, force-push or production alias change for phase 9.
- PASS exact diff against main is empty for verdict-engine.ts, all matchers including imprint.ts, all AI prompts, research/, and the original check/check-flow.tsx. check-service.ts only extracts reusable resolution and deduplicates shared lookups; single-pill runCheck still uses the same engine. No engine/photo tuning, changed thresholds or rescore. The current benchmark headline and every frozen artifact remain unchanged.
- Separate review caught the deployment body-size mismatch and mobile badges obscuring pills; corrected before final preview. Synthetic tests exposed touching-pill waists; fixed BEFORE live smoke. Unsupported Next cache-components runtime export and SDK integration types were corrected. Fixture masks were isolated from production detection instead of relaxing production checks for source-photo crops. No unresolved release-blocking code findings. Separate final handoff/evidence review found no additional issues; preserved the earlier handoff history and excluded unrelated planner prompts.

TESTS / LIVE RESULTS / LIMITS
- PASS: 296 network-free tests across 39 files, lint, optimized build and TypeScript at final implementation 6e22973. Same non-fatal Atkinson Mono fallback-font warning. New tests cover segmentation on white/black/yellow/low-amplitude wood-like texture, touching pairs, specks, zero/25/exactly20, EXIF and full-resolution crops; bottle rules, five-reader concurrency, scoped usage, upload limits, atomic quotas, privacy, overlay mapping and durable crash-safe budget/cache behavior.
- Verified all 200 development image files against their stored SHA256 and no product-code overlap with holdout. Only three DEVELOPMENT images selected as functional examples: blue levetiracetam 750 mg (42043019205-1), white metformin 500 mg (62037067410-1), orange glipizide 2.5 mg (00591090030-1). Crops use inspected bounds and silhouette masks; pill pixels/imprints remain from the NIH consumer photos. Repetition and declared FDA labels are intentional. These are controlled composites, NOT fresh accuracy evidence or real-bottle validation.
- All three live composites segmented into 9. Blue8+white: bottle MISMATCH, pill 9 MISMATCH, other 8 UNSURE (reader said gray vs FDA blue). Blue9 intended-all-right: bottle WARNING, all 9 UNSURE due the same gray/blue conflict. Orange8+blue: bottle MISMATCH, eight MATCH and pill 9 MISMATCH. The all-right case did NOT produce green; this failure is retained, not tuned away. Screenshot example is the actual orange8+blue replay with exactly one red marker.
- LIVE times: 7074 /710 /6722 ms. Three unique crop responses, 24 within-run cache hits, exactly $0.018822 in the smoke ledger. Cache-only replay added zero calls/spend and 27 cache hits. First cold cache-only run had correctly refused an uncached reading without a paid call. Production reader functions are used in smoke; labels are supplied FDA groundtruth, NOT AI label-photo readings. Raw live output is pasted below and retained as smoke-live.txt; cache replay and structured summary are alongside it.
- Additional API accounting: parent initially assumed a blank-bottle retake check was free. The specified pipeline reads the LABEL before segmentation, so two local API tests also read the same fictional label. Their token receipts were not retained. Free count_tokens measured 1037 input tokens for that exact prepared label/request. Conservatively reserving up to 12 generated attempts across both requests (2 manual attempts x 3 SDK transports per request), max 1200 output and 4096 extra input-token headroom yields $0.269688 for those checks. Combined conservative estimated verification bound: $0.288510, below the $1 cap; NOT an exact bill. No more paid calls were made. See usage-audit.json. Standard pricing verified at https://platform.claude.com/docs/en/about-claude/pricing; token-count endpoint is free per https://platform.claude.com/docs/en/build-with-claude/token-counting.
- The real test-images/real/bottle/ label.jpg+pills.jpg pair is still absent, so that conditional live check was SKIPPED. No claim that Kirkland softgels/real mixed-bottle phone photos were validated. Segmentation can miss low-contrast objects, refuse benign clutter/touching/large pills and cannot prove all physical contents were photographed. Appearance outlier warnings require an exact label NDC; a typical no-NDC look is not treated as uniquely expected. These limitations are visible or documented.

BROWSER / PREVIEW / HOW TO TEST
- PASS local and Vercel preview at 375/1440: captured mode, upload and nine-pill result/overlay; eight green plus one red, selection moves focus to bottle-pill-9, evidence expands with Enter, no overflow or runtime errors. Test driver replayed actual smoke result events at the API boundary to avoid paying again. This validates UI wiring, NOT a second paid end-to-end HTTP nine-pill run. Browser JPEG retained full 1440x1180 dimensions and still segmented into 9 using the actual detector.
- PASS actual local streamed API: valid fictional label read, empty bottle -> label steps, finding failed, friendly retake; no crop reading. Initial verifier wrongly asserted there would be no label step; corrected the expectation after observing the specified label-first behavior. No application change for that test assumption.
- PASS preview: malformed JSON and invalid image multipart return friendly 400 before AI; deployed native image validation loads correctly. Shared nine-pill result HTTP 200 with 9 markers and zero photo images, backed by actual Redis. This example expires after 7 days. Its neutral background is intentional privacy behavior.
- Lighthouse 13.6.0 accessibility: 100 default /check, 100 whole-bottle capture snapshot, 100 whole-bottle result snapshot, both locally and on PREVIEW. Automated scores are not a full accessibility certification. Reduced motion and keyboard row focus checked. Preview free legacy smoke passed: sample fallback MATCH 864 ms with 0 photo posts, typed MATCH 618 ms (server 148), typed MISMATCH 222 ms (server 57), identified Acetaminophen 500 mg. Existing one-pill behavior remains working.
- Implementation deployment 78ba2bb: dpl_EbpNgb1w6HUQKhfwd65CM2nejGqy, Ready, preview only. Handoff/evidence-only push follows. To review without any AI call, open the shared result link above. To try capture, /check -> Check the whole bottle. Verify every pill is numbered before relying on the photo's result. npm run smoke:bottle replays the local cache for free; use --live only with a new explicit budget/need and inspect the existing ledger first.

CURRENT STATE / NEXT STEP
- Review the preview, screenshot evidence and honest smoke outcomes; merge ONLY after Vedhanth explicitly says “merge” after reviewing THIS phase. Main remains the approved phase-8/addendum-1 release 763b47f.
- New untracked planner files prompts/phase-8-addendum-2.md and phase-8-addendum-3.md appeared while phase 9 was underway. They are preserved, NOT executed or committed. They request new demo mappings, color matching/prompt fixes and a different final real-pill set; addendum 3 supersedes their scenario tables while retaining their fixes. Those are separate scope, not silently folded into this frozen-engine feature. No real photographs accompanied them. Run them only when instructed.
- Planner was not contacted. No code work remains for the original phase 9 preview task; next step is Vedhanth's visual/product review, including whether to do the new addenda before a phase 9 merge.

LIVE SMOKE OUTPUT (verbatim; no credentials)
```text

> second-look@0.1.0 smoke:bottle
> node --env-file-if-exists=.env.local --import tsx scripts/smoke-bottle.ts --live

Mode: LIVE, budget reserved before every unique reading. Model claude-sonnet-5-5; standard $2 input / $10 output per million. Ledger test-images/bottle/generated/usage-ledger.json
{
  "scenario": "blue-eight-plus-white",
  "scope": "Functional demo, not benchmark evidence",
  "perPill": [
    {
      "number": 1,
      "verdict": "UNSURE",
      "imprint": [
        "L | 750"
      ],
      "appearanceWarning": "gray oval vs blue oval"
    },
    {
      "number": 2,
      "verdict": "UNSURE",
      "imprint": [
        "L | 750"
      ],
      "appearanceWarning": "gray oval vs blue oval"
    },
    {
      "number": 3,
      "verdict": "UNSURE",
      "imprint": [
        "L | 750"
      ],
      "appearanceWarning": "gray oval vs blue oval"
    },
    {
      "number": 4,
      "verdict": "UNSURE",
      "imprint": [
        "L | 750"
      ],
      "appearanceWarning": "gray oval vs blue oval"
    },
    {
      "number": 5,
      "verdict": "UNSURE",
      "imprint": [
        "L | 750"
      ],
      "appearanceWarning": "gray oval vs blue oval"
    },
    {
      "number": 6,
      "verdict": "UNSURE",
      "imprint": [
        "L | 750"
      ],
      "appearanceWarning": "gray oval vs blue oval"
    },
    {
      "number": 7,
      "verdict": "UNSURE",
      "imprint": [
        "L | 750"
      ],
      "appearanceWarning": "gray oval vs blue oval"
    },
    {
      "number": 8,
      "verdict": "UNSURE",
      "imprint": [
        "L | 750"
      ],
      "appearanceWarning": "gray oval vs blue oval"
    },
    {
      "number": 9,
      "verdict": "MISMATCH",
      "imprint": [
        "500"
      ],
      "appearanceWarning": null
    }
  ],
  "bottle": {
    "matched": 0,
    "unreadable": 8,
    "flagged": [
      9,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8
    ],
    "verdict": "MISMATCH",
    "title": "Pill 9 doesn't match your label.",
    "instruction": "Don't take any pills from this bottle; call your pharmacy."
  },
  "elapsedMs": 7074,
  "newSpendUsd": 0.01265,
  "totalUsage": {
    "budgetUsd": 1,
    "recordedSpendUsd": 0.01265,
    "committedUsd": 0.01265,
    "responses": 2,
    "uniqueReadings": 2
  },
  "cacheHits": 7
}
{
  "scenario": "blue-nine",
  "scope": "Functional demo, not benchmark evidence",
  "perPill": [
    {
      "number": 1,
      "verdict": "UNSURE",
      "imprint": [
        "L | 750"
      ],
      "appearanceWarning": "gray oval vs blue oval"
    },
    {
      "number": 2,
      "verdict": "UNSURE",
      "imprint": [
        "L | 750"
      ],
      "appearanceWarning": "gray oval vs blue oval"
    },
    {
      "number": 3,
      "verdict": "UNSURE",
      "imprint": [
        "L | 750"
      ],
      "appearanceWarning": "gray oval vs blue oval"
    },
    {
      "number": 4,
      "verdict": "UNSURE",
      "imprint": [
        "L | 750"
      ],
      "appearanceWarning": "gray oval vs blue oval"
    },
    {
      "number": 5,
      "verdict": "UNSURE",
      "imprint": [
        "L | 750"
      ],
      "appearanceWarning": "gray oval vs blue oval"
    },
    {
      "number": 6,
      "verdict": "UNSURE",
      "imprint": [
        "L | 750"
      ],
      "appearanceWarning": "gray oval vs blue oval"
    },
    {
      "number": 7,
      "verdict": "UNSURE",
      "imprint": [
        "L | 750"
      ],
      "appearanceWarning": "gray oval vs blue oval"
    },
    {
      "number": 8,
      "verdict": "UNSURE",
      "imprint": [
        "L | 750"
      ],
      "appearanceWarning": "gray oval vs blue oval"
    },
    {
      "number": 9,
      "verdict": "UNSURE",
      "imprint": [
        "L | 750"
      ],
      "appearanceWarning": "gray oval vs blue oval"
    }
  ],
  "bottle": {
    "matched": 0,
    "unreadable": 9,
    "flagged": [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9
    ],
    "verdict": "WARNING",
    "title": "Pill 1 looks different from your label's medicine.",
    "instruction": "gray oval vs blue oval. Don't take it; check with your pharmacist. We couldn't confirm its identity."
  },
  "elapsedMs": 710,
  "newSpendUsd": 0,
  "totalUsage": {
    "budgetUsd": 1,
    "recordedSpendUsd": 0.01265,
    "committedUsd": 0.01265,
    "responses": 2,
    "uniqueReadings": 2
  },
  "cacheHits": 16
}
{
  "scenario": "orange-eight-plus-blue",
  "scope": "Functional demo, not benchmark evidence",
  "perPill": [
    {
      "number": 1,
      "verdict": "MATCH",
      "imprint": [
        "WPI 900"
      ],
      "appearanceWarning": null
    },
    {
      "number": 2,
      "verdict": "MATCH",
      "imprint": [
        "WPI 900"
      ],
      "appearanceWarning": null
    },
    {
      "number": 3,
      "verdict": "MATCH",
      "imprint": [
        "WPI 900"
      ],
      "appearanceWarning": null
    },
    {
      "number": 4,
      "verdict": "MATCH",
      "imprint": [
        "WPI 900"
      ],
      "appearanceWarning": null
    },
    {
      "number": 5,
      "verdict": "MATCH",
      "imprint": [
        "WPI 900"
      ],
      "appearanceWarning": null
    },
    {
      "number": 6,
      "verdict": "MATCH",
      "imprint": [
        "WPI 900"
      ],
      "appearanceWarning": null
    },
    {
      "number": 7,
      "verdict": "MATCH",
      "imprint": [
        "WPI 900"
      ],
      "appearanceWarning": null
    },
    {
      "number": 8,
      "verdict": "MATCH",
      "imprint": [
        "WPI 900"
      ],
      "appearanceWarning": null
    },
    {
      "number": 9,
      "verdict": "MISMATCH",
      "imprint": [
        "L | 750"
      ],
      "appearanceWarning": null
    }
  ],
  "bottle": {
    "matched": 8,
    "unreadable": 0,
    "flagged": [
      9
    ],
    "verdict": "MISMATCH",
    "title": "Pill 9 doesn't match your label.",
    "instruction": "Don't take any pills from this bottle; call your pharmacy."
  },
  "elapsedMs": 6722,
  "newSpendUsd": 0.006171999999999999,
  "totalUsage": {
    "budgetUsd": 1,
    "recordedSpendUsd": 0.018822,
    "committedUsd": 0.018822,
    "responses": 3,
    "uniqueReadings": 3
  },
  "cacheHits": 24
}
Real bottle pair absent: skipped. Composites are not real-bottle validation.
{"final":{"budgetUsd":1,"recordedSpendUsd":0.018822,"committedUsd":0.018822,"responses":3,"uniqueReadings":3},"cacheHits":24}
```

## 2026-11-10 7:18 PM PST — Phase 9 preparation, exact model permission pending — prompts/phase-9.md

BUILDER: Codex
PREVIEW: NOT CREATED — whole-bottle implementation has not started.
HANDOFF — Phase 9
STATUS: PARTIAL — safe local checkpoint pending the required model execution permission, not a code or usage failure.

DONE / CURRENT STATE
- Phase 8 and its addendum were completed in order, merged and confirmed on production. Main and origin/main are 763b47f. Final deployment dpl_GFwfXLWP4LVEESzWgjL3ei65waMg reached Ready; final free API recheck returned MATCH, SAME_MEDICINE_DIFFERENT_MAKER and MISMATCH for the new real bottles. The addendum's full handoff follows below, including 245 passing tests and production accessibility 100 on all five main pages.
- Created feat/phase-9-bottle from that release. Preserved the planner's new prompts/phase-9.md, prompts/phase-9-partial-SUPERSEDED.md and test-images/real/README-bottle.md verbatim in this local WIP checkpoint. ONLY phase-9.md is authoritative; do not execute the superseded partial prompt. No feature source code or benchmark/photo data changed for phase 9. Branch is not pushed, deployed or merged.
- Vedhanth explicitly requires GPT-6.1 Sol on High for phase 9. This chat cannot change its own model. Available multi_agent_v1.spawn_agent supports model gpt-6.1-sol and reasoning_effort high, but its tool instructions require explicit permission to delegate/spawn. Asked via the pending asynchronous question whether to delegate phase 9 to that exact model and review the work here. No reply received at this checkpoint; do not assume silence is permission. No alternate model has built phase 9.

LEFT / NEXT COMMAND
- All implementation tasks 1–9 in phase-9.md remain: code-only segmentation/crops/warnings; concurrent existing Sonnet readers with cost/crop caps; pure per-pill and bottle rules; streaming/rate-limited private API and photo-free stored results; accessible overlay/UI preserving one-pill flow; development-only composite live smoke within $1; tests; docs/screenshots; reviewed branch push and Vercel preview handoff. No phase-9 tests, paid model calls or evaluation have run. Phase-9 spend: $0.
- Next action after Vedhanth approves model delegation: use multi_agent_v1.spawn_agent with model gpt-6.1-sol and reasoning_effort high for the bounded phase-9 implementation, then review/integrate its changes, run all required verification and obtain a real preview. Re-read AGENTS/docs/current prompt first. Never merge phase 9 until Vedhanth reviews that feature's preview and explicitly says merge.
- Existing production is healthy. All temporary local optimized servers started for the addendum were stopped. No credential values were printed or put in prompts. Planner was not contacted.

## 2026-11-10 7:16 PM PST — Real demo bottles and shared-seller honesty fix — prompts/phase-8-addendum.md

BUILDER: Codex
HANDOFF — Phase 8 addendum
STATUS: DONE — built on feat/phase-8-addendum, reviewed, merged under Vedhanth's explicit authorization, and confirmed on https://getsecondlook.vercel.app. A final provenance/verification-script cleanup and this handoff follow; application behavior is identical to the verified release.

WHAT I DID / FILES
- Recorded actual live FDA metadata in src/lib/fda/__fixtures__/real-demo.json using scripts/record-real-demo.ts, including source URLs and DailyMed publication metadata. Snapshot timestamp is Nov 11 UTC / Nov 10 Pacific. Kirkland NDC 63981-598: blue capsule IB1, 19 mm, rxcui 310964, Costco Wholesale, COMPLETED. Advil Liqui-Gels NDC 0573-0169: green capsule Advil, 20 mm, rxcui 731533, Haleon, ACTIVE. Tylenol NDC 50580-937: white oval TYLENOL / 500, 19 mm, rxcui 209459, Kenvue, ACTIVE.
- Verified 310964 generic capsule and 731533 Advil capsule resolve to the SAME generic group, 211 deduplicated products. Updated demo-scenarios.ts, sample-results.ts, /labels defaults, /type prefill buttons and the home drawings to these real bottles. Mismatch identifies Tylenol (acetaminophen 500 mg). Kept the original tablet demos separately in __fixtures__/tablet-scenarios.ts for unchanged I2/L484 regression coverage.
- Added listing-evidence.ts: presentation-only grouping by the selected FDA record's complete normalized imprint, color codes and shape; product codes and seller names deduplicated separately; size ignored; exact label NDC first when present. Current blue IB1 look: 14 product records / 12 sellers. TYLENOL / 500 look: 16 records / 7 sellers. ResultView shows three names plus remaining seller count, an expandable complete linked list, and an explicit explanation that appearance cannot identify a unique manufacturer. Same-medicine card says sold by 12 companies, rather than made by a uniquely selected company. Historical results lacking the optional metadata remain renderable.
- Added the calm exact-package no-longer-marketed note without changing MATCH. Reference records are identified as reference NDCs; discontinued records remain annotated. Updated architecture decisions and all three real-photo README shot lists: close angled light for shiny PRINTED IB1, TYLENOL and 500 on opposite sides for the existing flip flow. There are still no real sample photos; no images were fabricated or read with AI.
- Added scripts/screenshots-addendum.mjs and 20 screenshots under docs/screenshots/phase-8-addendum/, including the three live typed result states, samples, labels and home at 375/1440, plus expanded sellers and a mobile pill detail. Fixed sample card alignment for Tylenol's second-side caption and preserved brand capitalization.

EXACT ENGINE CHANGES / NO TUNING
- verdict-engine.ts changed ONLY explanation text: (1) inactive-match reason now says the exact package is no longer marketed but its record matches; (2) exact-label MATCH no longer attributes the pill to one maker; (3) other-record color/shape conflict no longer attributes one maker; (4) other-record unknown-appearance explanation removes that attribution; (5) SAME_MEDICINE names the label's listed seller and says another FDA-listed version matches, without claiming the selected seller made the pill; (6) no-NDC MATCH removes the single-maker attribution; (7) mismatch identification says the imprint is listed for the medicine, without claiming a unique maker. No condition, ranking, candidate selection, confidence threshold or verdict changed.
- imprint.ts and every other matcher are unchanged. AI prompts and all research data/results are unchanged. No photo tuning or benchmark rerun. The new listing metadata in check-service.ts is computed after decide returns and cannot affect its decision.
- PillDrawing's deterministic SVG paint-ID hash now includes display scale and ruler state. This fixes hidden decorative SVG definitions affecting the real blue pill on mobile. No geometry, FDA color, scale or public prop API changed.

TESTS / REVIEW / HOW TO TEST
- PASS 245 network-free tests / 29 files; lint, TypeScript and optimized build. The only build warning is the existing Atkinson Mono fallback warning. Added 13 seller/real-demo tests. Retained the old tablet service/engine cases; changed the photo-view conflict test from blue to white because the new correct demo is blue, preserving its original conflict assertion. No assertions were weakened to fit photos.
- PASS LIVE FDA smoke, cold: MATCH 1686 ms; SAME_MEDICINE_DIFFERENT_MAKER 609 ms; MISMATCH 1113 ms, Tylenol identified. Warm: 0 / 2 / 10 ms. Same-drug products compared: 211. Exact Kirkland DailyMed published 2026-04-22; Advil 2026-07-31; selected matching/identified records also have their actual linked publication dates.
- PASS /type prefills against live FDA at both widths. Latest local server times: MATCH 606 ms, SAME_MEDICINE 404 ms, MISMATCH 560 ms. Expanded list has all 14 real FDA links and Costco's exact NDC first. No runtime errors, overflow or photo-check requests. Local Lighthouse /type and /samples: 100 each.
- Separate Codex review before push caught stale original-default test inputs, the conflicting-view test's new identical color, Tylenol card misalignment, duplicated discontinued wording, SVG paint-ID reuse, and brittle hardcoded counts in the LIVE verifier. Fixed each. Recorded-fixture count assertions remain fixed to their immutable snapshot; live count assertions now accept real FDA updates while verifying the generic capsule group.
- PRODUCTION PASS at code 59d2da5, deployment dpl_GWzyryx4epj6VLxaZY6WqLDEVWah, Ready: real /type prefill MATCH 744 ms (server 143 ms, 14 versions/12 sellers); SAME_MEDICINE_DIFFERENT_MAKER 192 ms (36 ms server, 14/12); MISMATCH 310 ms (44 ms server, Tylenol, 16/7). Zero photo posts, AI calls or browser errors. Re-ran production Lighthouse: home 100, /check 100, /type 100, /samples 100, /research 100.
- To reproduce: open /type, select each of the three real demo prefills, then Check my pill. Expand the sellers on the matching result and confirm Costco/NDC 63981-598 first. Check /labels uses capsule form and the new codes. npm run smoke:fda reproduces all three live API-backed outcomes.

PROBLEMS / CURRENT STATE / NEXT STEP
- Paid AI calls/spend this addendum: 0 / $0. Original PDFs unchanged. Composio discovery returned 401; existing Git/Vercel auth worked. No model calls were needed for typed checks.
- First-side Tylenol photo/flip behavior has NOT been tested with real photos. Existing flip prompts depend on unreadable/partial text and the expected record; a clear mismatch is not forced into a flip. The shot list documents both sides but does not claim a paid photo flow was verified.
- Phase 8 and this addendum are released. Phase 9 remains a separate authorized task and must stay on feat/phase-9-bottle with a preview, unmerged until Vedhanth explicitly reviews and says merge. Exact requested builder model: GPT-6.1 Sol, High. A model-delegation permission question is pending because this chat cannot change its own model and the available agent tool requires explicit delegation permission. No substitute model has begun phase 9. Planner was not contacted.

## 2026-11-10 7:00 PM PST — Phase 8 approved merge and production confirmation — chat

BUILDER: Codex
HANDOFF — Phase 8 release
STATUS: DONE
- Vedhanth reviewed the preview and explicitly authorized the merge. Separate review confirmed the tested branch tip, clean diff checks and unchanged checker/API/research paths. Fast-forwarded main from 3ad03e8 to 910afb4 and pushed main.
- Production dpl_7bTdqTKSy4r4goGRWzEfcYPz7j9M reached Ready. Confirmed https://getsecondlook.vercel.app contains the v2 hero/bento and its social PNG matches local bytes. Free production smoke PASS: sample fallback MATCH 846 ms with zero photo posts; typed MATCH 621 ms (server 122 ms); typed MISMATCH 270 ms (server 65 ms), identified as Acetaminophen 500 mg. No AI calls/spend.
- Composio discovery returned 401; existing Git/Vercel authentication worked. Next authorized task is phase-8-addendum on its own branch, with permission to merge after checks; phase 9 must remain preview-only until a later explicit merge.

## 2026-11-10 6:27 PM PST — Phase 8: premium visual redesign preview — prompts/phase-8.md

BUILDER: Codex
PREVIEW: https://second-look-git-feat-phase-8-redesign-vedhanth.vercel.app
HANDOFF — Phase 8
STATUS: DONE — visual redesign pushed to feat/phase-8-redesign, preview verified. Awaiting Vedhanth's visual review and explicit “merge”. Main and production remain at 3ad03e8.

WHAT I DID / FILES
- Preserved the planner's incoming DESIGN v2, archived v1, DEVPOST, SCRIPT and phase-8 prompt verbatim in 058d341 before implementation. Followed v2's system SF stack with next/font Inter fallback; kept Atkinson Mono for distinctive imprint/NDC/strength characters. Replaced the v1 palette, radii, typography, elevation and pill buttons; added the sticky translucent navigation and compact footer.
- Rebuilt home with the large hero, CSS iPhone containing a real computed MISMATCH ResultView, floating FDA-drawn pills, cited stat band, AI/code sequence, varied bento grid, live product count, prescribed frozen research numbers and final CTA. Live ibuprofen count was 507. The spec says “3-step” but explicitly lists Photograph → Read → Check → Answer; implemented the four listed stages.
- Updated PillDrawing's bevel/contact shadow and color glow, preserving its API, dimensions and geometry. Restyled all four verdicts with distinct tints and symbols, comparison panels, feature list, source chips and pharmacist script. Moved the script after the evidence in the DOM so keyboard and reading order agree. Restyled /check, /type, /samples and detail pages, /sources, /research charts, /labels screen view, /style, /one-pager screen view and 404 through shared tokens/components. Existing forms, requests and result conditions are unchanged.
- Refreshed the orange bottle SVG/ICO, 1200×630 social card and complete typed-mismatch screenshot used on the screen one-pager. Added scripts/export-brand.mjs and scripts/screenshots-phase8.ts; export-one-pager.mjs accepts safe temporary output paths; the free smoke accepts the new sample CTA label.
- Saved 34 BEFORE and 34 AFTER screenshots, plus the social card, in docs/screenshots/phase-8/. Thirteen routes and all four result states are captured at 375 and 1440. Viewed every AFTER image; inspected the long mobile style gallery in readable sections. Result-only captures hide the sticky nav during capture, while full-page screenshots retain it. Screenshots use the existing network-free computed FDA fixtures for deterministic result states and abort photo-check requests.

FROZEN BEHAVIOR / SPEND
- PASS: git diff --exit-code main -- src/lib src/app/api research is empty. No verdict-engine.ts, imprint.ts, AI prompt, FDA parser, matching, threshold, research record/result or API behavior changes in this phase. No test-photo tuning or benchmark reruns. Frozen research headline and full caveats remain on /research.
- All three test-images/real folders still contain only READMEs. Did not invent photos or run samples:build. The phone and bento explicitly say typed/supplied pill details and use real FDA drawings; uploaded-photo behavior continues through the existing ResultView. Photo-backed replay remains untested until photos are supplied.
- Paid AI calls: 0. Phase spend: $0. The optional paid production smoke was NOT RUN; only free sample/typed checks were needed for this visual phase.

TESTS / ACCESSIBILITY / PREVIEW
- PASS: 232 tests in 28 files (209 existing plus 23 contrast checks); npm run lint, npx tsc --noEmit and optimized next build. One existing non-fatal Atkinson Mono fallback-font warning remains. git diff --check passes.
- PASS Lighthouse 13.6.0 mobile accessibility on the Vercel PREVIEW: / 100, /check 100, /type 100, /samples 100, /research 100, zero failed automated audits. Summary saved as docs/screenshots/phase-8/accessibility.json. Automated scores do not certify every accessibility requirement.
- Explicit AA checks cover both endpoints of every verdict gradient, dark instructions, orange normal/hover buttons and secondary text. Worst title ratios: match 4.77:1, same 5.02:1, mismatch 4.62:1, unsure 9.63:1. Ink on orange is 7.65:1; white on orange is only 2.20:1, so buttons use ink. Secondary text on gray is 4.66:1. Darkened blue links on gray to #0066cc after Lighthouse caught the original blue's contrast failure.
- Browser PASS: skip link first, brand link next; result focus offset for sticky nav; no runtime errors or horizontal overflow in screenshot routes at 375/1440; home also fits 1920. At prefers-reduced-motion: reduce, hero, floating pills, verdict and icon animations all compute to none and button transitions to 0s. Normal mode retains hero-reveal, pill-float, verdict-reveal and icon-draw.
- FREE preview smoke PASS: home → sample fallback MATCH in 834 ms, zero /api/check posts; typed I2/orange/oval MATCH in 657 ms (server 155 ms); typed L484/white/oval MISMATCH in 254 ms (server 67 ms), identified as Acetaminophen 500 mg. Additional free /api/verify checks returned SAME_MEDICINE_DIFFERENT_MAKER (302 ms server) and low-confidence UNSURE (0 ms cached server). Metadata, icon, friendly 404 and mobile widths passed.
- Initial implementation deployment ed8497e: dpl_2cds78LSKGeoHH9V944QPfbUehWu, Ready, preview-only. Preview social-card.png, one-pager-result.png and second-look-one-pager.pdf match local bytes. Handoff-only commit follows; no application code changes after verification.

REVIEW / PROBLEMS / DECISIONS
- Separate Codex self-review before push: fixed insufficient blue-on-gray link contrast; aligned desktop sample card rows; hid crowded mobile decorative floating pills; corrected sticky-nav overlap in result screenshots; changed script DOM order to match visual/keyboard order; explicitly set the 56px desktop display size because Tailwind's inlined token did not respond to a media variable; fully disabled reduced-motion effects. No unresolved release-blocking findings.
- The final v2 print candidate measured 981.9 CSS px, exceeding the existing 979px one-Letter-page guard. Retained BOTH original phase-7 PDFs exactly as task 7 allows. PDF SHA-256 remains 5eeccaa7d0ac65c23a97928f36936fb3d2835b424bb07e766334ea1b0098a6c0. Screen version is v2; downloaded PDF is the verified phase-7 layout. Temporary candidates were never copied to the canonical PDF paths.
- Composio tool discovery returned HTTP 401; used existing Git/Vercel authentication. First Git upload disconnected; a normal retry succeeded. No force push, main push or manual production alias change.
- A NEW untracked prompts/phase-8-addendum.md appeared during work. It requests scenario/behavior changes beyond this prompt's explicit visual-only freeze. Left it untouched and uncommitted; it needs a separate authorized task. Planner docs saved at phase start were not rewritten or sent anywhere.

CURRENT STATE / NEEDS VEDHANTH / NEXT STEP
- Review the PREVIEW above, including home and /samples. Merge only after Vedhanth explicitly says “merge” following that review. Branch: feat/phase-8-redesign. Main/production unchanged. No implementation work remains for the original phase-8 prompt.
- Keep the phase-7 PDF for submission unless a later authorized task produces and visually verifies a single Letter-page replacement. Treat the new addendum as separate scope. Planner was not contacted; tell the planner “handoffs” when ready.

## 2026-11-10 3:12 PM PST — Phase 7: final one-pager copy and comparison — prompts/phase-7.md

BUILDER: Codex
HANDOFF — Phase 7
STATUS: DONE — content-only change released to main and verified on production. Feature freeze still in effect.

WHAT I DID / FILES
- Replaced `/one-pager` with the planner's exact copy and frozen comparison table. Live `/sources` and `/api/lookup` agreed on **507** deduplicated ibuprofen 200 mg products (426 active), so the copy's count stayed unchanged. No verdict logic, prompts, benchmark data or results changed.
- `scripts/export-one-pager.mjs` uses the live FDA-backed typed check for `0113-0517` + white oval `L484`: MISMATCH, identified as acetaminophen 500 mg. It captures the entire red verdict and both side-by-side drawings in one screenshot without cutting either card. Replaced `public/one-pager-result.png` and removed the obsolete separate pill crop (recoverable from Git). No model calls or spend.
- Print layout places the explanation next to the full screenshot and fills the Letter sheet. Kept the citations, live links and QR. Re-exported identical tagged PDFs to `public/second-look-one-pager.pdf` and `docs/second-look-one-pager.pdf`; screenshots at 375 px, 1440 px and rendered Letter are in `docs/screenshots/phase-7/`.
- All three `test-images/real` sample directories still contain only READMEs. Skipped `samples:build`; saved FDA examples unchanged. No photos were fabricated.

TESTS / REVIEW / HOW TO TEST
- PASS: 209 tests in 27 files; lint, tsc and optimized build, with the same two non-fatal Atkinson fallback warnings. Local free smoke passed: recorded sample fallback with zero photo posts, typed MATCH, typed MISMATCH. `/one-pager` Lighthouse 13.6.0 accessibility: 100 locally. No horizontal overflow at 375 or 1440.
- Print review: the full screenshot made the first print layout too tall. Fixed with a two-column print layout and inspected the new render; **1 page, 612 × 792 pt (US Letter), tagged**, no clipped content or large blank bottom. Separate self-review confirmed exact copy and numbers, the whole comparison, unchanged safety/research code and no stray assets. Composio returned 401, so used existing Git/Vercel auth.
- PASS production: main `44bfdfa` deployment `dpl_Gos4ytaks4uDFKeKhiaydLLrVi9i` is Ready. The [one-pager](https://getsecondlook.vercel.app/one-pager) shows the new copy; the [PDF download](https://getsecondlook.vercel.app/second-look-one-pager.pdf) and comparison PNG match the local files byte-for-byte. PDF SHA-256: `5eeccaa7d0ac65c23a97928f36936fb3d2835b424bb07e766334ea1b0098a6c0`.

CURRENT STATE / NEXT STEP
- Use the live PDF for submission. To re-export, run `node scripts/export-one-pager.mjs` against an optimized local build, then check with `pdfinfo` and inspect a fresh render. No open code tasks for Phase 7. Real sample photos remain optional when supplied. Planner was not contacted.

## 2026-11-10 2:43 PM PST — Phase 6: safety follow-up, demo checks and one-page PDF — prompts/phase-6.md

BUILDER: Codex
HANDOFF — Phase 6
STATUS: DONE — released to main and verified on production. FEATURE FREEZE: bug fixes only.

WHAT I DID / RELEASE
- Vedhanth explicitly accepted phase 5 as an honest result, not as a coverage success. Fast-forwarded main to `3e1c6aa` first and confirmed its production deployment (`dpl_7nTQ9LYqZMjxK16RQ6FnBcMYz2Aw`). Then worked on `feat/phase-6`, preserving the interrupted work and planner prompt. Phase 6 implementation and assets shipped through `b000127` on main; production `dpl_CRhsFqSwvD4ZR3Q7tbtEofRonDNM` reached Ready and the public alias caught up shortly after. No manual alias change was needed.
- /research leads with the frozen one-view result: **150 photos / 300 pairs, 1/150 wrong passed, 83/88 correct when answered, 212/300 (70.6%) uncertain**. Direct AI: 83/94 correct when answered, 9 vs 4 false alarms, 2 vs 1 wrong passes, 206/300 uncertain. The coverage goal was not met. Added three plain-language takeaways, an explicit post-hoc section, and main-branch audit links. Original freeze, pair CSV, caches, frozen results and cost ledgers are unchanged.
- Noindex `/one-pager`, tagged one-page US Letter PDF (612 × 792 pt), identical copies at `public/second-look-one-pager.pdf` and `docs/second-look-one-pager.pdf`. Includes primary-source citations, QR/live URL, pipeline diagram and two real UI screenshots from the recorded FDA sample. Poppler page-size and visual render checks PASS. Published PDF SHA-256: `f58b3bbfcc18e0da6b54ce3668e6cf4dd6de8c36bba9d5ab2a8041233448bd0a`.
- Amber bottle SVG/ICO, site-wide title/description and social metadata, 1200×630 Open Graph PNG using the recorded FDA pill dimensions, friendly HTTP 404. Research/one-pager at 375 and 1440 and the social card are in `docs/screenshots/phase-6/`. Captured from an optimized build so no development indicator is in the screenshots. Production PDF and PNG bytes match local files.

EXACT SAFETY CHANGES AND WHY
- `src/lib/match/imprint.ts`: exact matching, normalization, stopwords and confusable map unchanged. A folded partial match, or full folded match requiring changes to the multiset of 1–2 character tokens, is marked `requiresExact`. Counting repeats matters (`S;S;5` vs `S;5;5`). The explicit complete `I2`/`12` exception remains; `I2;44`/`12` does not qualify. Full long `L484`/`1484` and exact visible subsets retain their previous behavior.
- `src/lib/verdict-engine.ts`: `requiresExact` cannot yield MATCH or SAME_MEDICINE_DIFFERENT_MAKER. If it is the only usable imprint evidence, return UNSURE with a plain explanation; do not turn an ambiguous look-alike into MISMATCH. Rank eligible other-maker hits ahead of the ambiguous ones. Mark the actual imprint row uncertain, not green. The original cached lisinopril `5` vs ropinirole alternative `598;S` wrong pass now returns UNSURE. No confidence threshold, FDA grouping, AI prompt or mismatch identification rule changed.
- `src/lib/pill-views.ts`: accepts known colors that are exact or close under the existing matcher, like the shape rule. Known different appearance stays a conflict. Unknown/low-confidence appearance stays uncertain with a distinct reason; no confidence threshold lowered. Both changes were authorized after the frozen test; no additional tuning or readings.

AFTER TWO FIXES (POST-HOC — THIS HOLDOUT IS NO LONGER UNTOUCHED)

| Cached set | Wrong caught | Wrong passed | False alarms | Right passed | Correct / answered | Unsure |
|---|---:|---:|---:|---:|---:|---:|
| Development, one view | 66/200 | 0/200 | 2/200 | 56/200 | 122/124 | 276/400 |
| Development, two views | 45/200 | 0/200 | 4/200 | 37/200 | 82/86 | 314/400 |
| Former holdout, one view | 46/150 | 0/150 | 4/150 | 37/150 | 83/87 | 213/300 |
| Former holdout, two views | 33/150 | 0/150 | 7/150 | 24/150 | 57/64 | 236/300 |

The one-view fix removed one observed wrong pass by abstaining. Two views answered more often but made more false alarms (holdout 4→7; development 2→4). Zero observed wrong passes is not proof of safety. No fresh-test claim. `env -u ANTHROPIC_API_KEY node --import tsx scripts/rescore-post-fix.ts` used $0, zero model calls, and writes only `research/out/post-fix-{development,holdout}.json`. Independently reconciled all 300 post-hoc holdout pair identities to the frozen CSV and verified input/source hashes. Frozen report and data remain the headline in the app, PDF and README.

TESTS / ACCESSIBILITY / REVIEW
- PASS: 209 network-free tests in 27 files; lint, TypeScript and production build. Two existing non-fatal Atkinson fallback-font warnings. Separate self-review before push caught repeated short tokens, an uncertain imprint displayed as a green row, initial focus stealing the skip link during Strict Mode replay, and a dev overlay on the exported social card. Fixed and verified each. No remaining release-blocking findings. Composio returned 401; used existing Git and Vercel auth.
- Lighthouse 13.6.0 accessibility (mobile, public production alias after promotion): **100 home, 100 /check, 100 /type, 100 /samples, 100 /research**. No failing automated checks. Browser verified skip link first, then brand link; capture heading focus moves only on phase change. CheckingSteps has a named polite live region; verdict names, input labels, keyboard focus, and mobile widths checked. Impeccable audit and visual inspection kept the established pharmacy materials and readable layout. Automated scores are not a full accessibility certification.
- Chrome print export was too tall initially. Scoped compact print styles, used a fresh print page with fonts and both screenshot images loaded, then checked exactly one tagged Letter page. Reproduction: start an optimized local build, `node scripts/export-one-pager.mjs http://localhost:3213`. Do not use a dev server for release screenshots.

PRODUCTION HOW TO TEST / SPEND
- PASS home → “Run the sample check” → recorded FDA MATCH in **824 ms**. No `/api/check` request. All three `test-images/real` directories have README only, so did not run `samples:build` or fabricate photos. Photo-backed sample replay remains untested until those photos exist.
- PASS `/type` with `0113-0517`, I2/orange/oval → MATCH in **559 ms** (FDA 92 ms); L484/white/oval → MISMATCH with acetaminophen 500 mg in **208 ms** (FDA 55 ms).
- PASS `/check` at 375 px: uploaded the existing fictional ibuprofen label and the real NIH `test-images/pills/strattera-10mg-1.jpg`; one POST, HTTP 200, “Lilly 3227 10 mg” read, all eight progress events, MISMATCH in **6,377 ms** (server pipeline 5,305 ms, FDA 83 ms), shared result HTTP 200. No second view request or retry was sent by the smoke script. These were deliberately different medicines. Exact real demo bottles were not tested.
- Live-app estimated usage **$0.0181763 / $1** at published Anthropic rates, from three responses logged for that one production check: Sonnet 1778 in / 297 out and 3805 in / 375 out; Haiku 403 in / 500 out. No cache tokens. Logs record only model and token counts, never photos/transcriptions. Paid research spend this phase **$0**.
- `node scripts/smoke-phase6.mjs https://getsecondlook.vercel.app` is the free smoke. `--live-photo` explicitly opts into at most one paid app check; do not add it just to verify the handoff. Production `/research`, `/one-pager`, PDF/social assets, amber favicon, and friendly 404 passed.

CURRENT STATE / NEXT STEP
- Production: https://getsecondlook.vercel.app. Submission PDF: https://getsecondlook.vercel.app/second-look-one-pager.pdf. Feature freeze: keep the frozen evidence and post-hoc caveat in the demo/Devpost, record the demo and submit. Real bottle photos remain an optional content update using the existing flow. No new benchmark spend. Planner was not contacted; tell the planner `handoffs` when ready.

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


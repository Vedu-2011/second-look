# Phase 9 — Whole-bottle check: one photo of all the pills, every pill checked, odd one flagged
(Planner-authorized exception to the feature freeze — Vedhanth's call: a refill may hold ONE wrong pill among many.)

Read first (as always): AGENTS.md and everything it lists, newest HANDOFF.md entry, git status + log. Plan in 3–5
bullets first. Do this AFTER phase 8 is merged and the phase-8 addendum is done. Branch feat/phase-9-bottle; Vercel
preview first; merge only when Vedhanth says "merge". If usage runs low: "Stop and hand off" rules.

## Principle (same as the whole app)
CODE finds the pills. AI reads each pill. CODE decides each pill and the bottle. The AI never decides.

## Flow (new mode on /check: "Check the whole bottle" next to "Check one pill"; keep the one-pill flow unchanged)
1. Label photo (existing reader).
2. "Pour the pills onto a plain surface that's a different color from the pills (a sheet of colored paper works
   well). Spread them out so they don't touch. Letters up if you can." One photo. Max 20 pills.
3. Live steps: Reading your label → Finding the pills → Reading each pill (n of N) → Checking with FDA records.
4. Result: the user's photo with a numbered circle on every pill (green match/same-medicine, red mismatch, gray
   can't tell) + a list (pill 1…N with mini crop, reading, verdict) + ONE bottle verdict card on top.

## Tasks
1. Pill finding (src/lib/bottle/segment.ts, pure + unit-tested, using sharp raw pixels — no AI):
   - Downscale to ~1200 px long edge. Estimate the background color from the border (median in Lab). Mask pixels by
     Lab distance from background (adaptive threshold, e.g. Otsu on the distance), morphological open/close,
     connected components, drop specks/huge regions by area relative to the median blob, split nothing fancy.
   - Output boxes (with padding) + crop each pill at FULL resolution from the original. Return also "touching or
     clutter" warnings (blob area > 2.2× median, aspect weirdness, >20 blobs, 0 blobs, background too varied).
   - If it fails (0 pills, >20, cluttered background) → friendly retake message with the tips. Never guess.
   - Tests on synthetic images: N colored ellipses/capsules on plain backgrounds (white, black, yellow, wood-like
     noise), touching pairs, specks, 0 and 25 pills.
2. Reading: run the existing production readPill on each crop (concurrency 5, Sonnet), reuse caching/cleaning.
   Each crop is one pill → existing single-pill rules apply. Track cost; cap 20 crops.
3. Deciding (src/lib/bottle/decide-bottle.ts, pure): existing engine per pill with the SAME label data (FDA lookups
   once per bottle, cached). Bottle rule:
   - ANY pill MISMATCH → bottle RED: "Pill 7 doesn't match. Don't take any pills from this bottle; call your
     pharmacy." (name the identified medicine for that pill only if the engine identified it).
   - Also flag appearance outliers even when the imprint is unreadable: a pill whose confident color OR shape is
     "different" from the label's FDA record → that pill is MISMATCH-by-appearance? NO — keep the engine's rules:
     it's UNSURE per pill, but the bottle card says "Pill 7 looks different from your label's medicine (white oval vs
     blue capsule). Don't take it; check with your pharmacist." (bottle-level wording, still red/amber, never green).
   - All MATCH/SAME_MEDICINE → green "All N pills match your label." Some UNSURE (no outliers) → neutral "N pills
     match; M couldn't be read — flip those and take another photo" (retake button).
   - Never show the bottle as green if any pill is UNSURE-with-outlier or MISMATCH.
4. API: POST /api/check-bottle (streamed steps like /api/check), same rate limit (a bottle counts as N/5 checks,
   min 1) and daily cap; images never stored; result saved (no photos) for /result/[id] with the numbered overlay
   drawn from stored boxes on a neutral background.
5. UI (DESIGN.md v2): overlay circles numbered, colored by verdict, tappable → scroll to that pill row; bottle card
   tinted like verdicts; mini crops in rows; "Check one pill" path still prominent. Mobile first. Lighthouse a11y
   100 on /check. Reduced motion respected.
6. Test before photos exist: compose bottle images from real NIH consumer crops (from research/data, development
   cohort only) pasted on plain backgrounds: e.g. 8 of one product + 1 different product. `npm run smoke:bottle`
   runs 3 composites LIVE (≤ $1 total) and prints per-pill verdicts + bottle verdict + time + cost. Paste output in
   the handoff. If test-images/real/bottle/{label.jpg,pills.jpg} exist (Vedhanth's Kirkland softgels + 1 Tylenol
   caplet), run that too.
7. Tests: segmentation (synthetic), bottle rules (any mismatch → red; outlier → never green; all match → green;
   unsure → retake), API streaming + caps, overlay mapping. Keep all existing tests green.
8. Docs: README section, /research page note (not part of the benchmark — say so), DEVPOST "What it does" bullet
   (planner will edit wording). Screenshots 375 + 1440 of a 9-pill result with one red pill →
   docs/screenshots/phase-9/.
9. HANDOFF at the top (BUILDER line, PREVIEW url, smoke output, spend, known limits).

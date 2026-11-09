# Phase 1 — Real FDA data layer, matcher and verdict engine (still no AI calls)

Read first: ~/Hackathons/CLAUDE.md, ./CLAUDE.md, docs/ARCHITECTURE.md (incl. "Decisions after phase 0"),
docs/DESIGN.md. Plan in 3–5 bullets before coding.

## Goal
Everything that DECIDES a verdict, built and proven with real FDA data and lots of tests — so phase 2 only has to
plug Claude's photo reading into it. By the end, a dev page lets us type what's printed on a label and what's on a
pill and get a real, FDA-backed result screen.

## Tasks
1. FDA clients (src/lib/fda/), all server-side, every response cached in Redis 24h (key("fda:" + url)), with an
   in-memory fallback if Redis is down, 8 s timeouts, one retry, friendly typed errors:
   - rxnav.ts: approximateTerm(term) → best rxcui + name; ndcProperties(ndcOrRxcui) → parsed Product[] (dedupe by
     ndc9; fields: ndc9, ndc10, rxcui, setId, labeler, name/strength if available, imprintRaw, imprintTokens,
     colorCodes[] (split packed "C48325;C48331"), shapeCode, sizeMm, scored (SCORE "1" = NOT scored), marketingStatus,
     active boolean). Accept NDCs in any format (4-4-2, 5-3-2, 5-4-1, 10 or 11 digits, with/without dashes).
   - dailymed.ts: label metadata for a setid (title + published date + drugInfo URL). Find the right v2 endpoint
     and verify it live; the v1 imprint endpoint is dead.
   - Measure: rxcui 310965 (ibuprofen 200 mg tab, ~1,385 products) cold and warm. Cold must be < 4 s in prod; if
     not, cache a slimmed product list per rxcui.
2. Matcher (src/lib/match/), pure functions:
   - imprint.ts: tokenize FDA imprints (split on ";" and spaces; drop descriptor words like logo, underline,
     asymmetrical, bisect, score, debossed — keep a tested stoplist), normalize (uppercase, strip - . / spaces),
     compare pill-read tokens vs FDA tokens: exact | close (confusables O↔0, I↔1↔L, S↔5, B↔8, Z↔2, G↔6) | none.
     Side order must not matter ("44;291" = "291 44"). "I-2", "I 2", "i2" all equal "I2".
   - color.ts: map read colors and FDA codes to one vocabulary; exact | close (white↔gray↔off-white,
     brown↔orange↔red, pink↔red, yellow↔orange, purple↔blue, green↔turquoise) | different.
   - shape.ts: exact | close (oval↔capsule↔oblong↔rectangle) | different.
3. Verdict engine (src/lib/verdict-engine.ts), pure, input = { label: {ndc?, drugName?, strength?, form?},
   pill: {imprintSides[], imprintConfidence, colors[], colorConfidence, shape, shapeConfidence, form,
   guess?: {drugName, strength}}, data: {labelProduct?, sameDrugProducts[], guessProducts?} } → output exactly
   as in ARCHITECTURE.md (verdict, features[{name, expected, found, result}], expected product, matchedProduct,
   identifiedAs?, evidence[], reasons[] in plain words). Rules:
   - MATCH: imprint matches the label's exact NDC product (or, with no NDC, any product of that drug+strength)
     and color/shape are exact or close.
   - SAME_MEDICINE_DIFFERENT_MAKER: label has an NDC, pill isn't that product, but imprint matches another
     product of the same rxcui and color/shape agree. Return that product as matchedProduct (labeler + NDC).
   - MISMATCH: imprintConfidence ≥ 0.7 and imprint matches NO product of the label's drug+strength. If the guess's
     products contain the imprint → identifiedAs (drug, strength, labeler, NDC, setId). Else identifiedAs = null.
   - UNSURE: no/blank imprint, imprintConfidence < 0.7, label drug not found in RxNav, or imprint matches but
     color/shape are "different". Reasons say which.
   - Prefer active products for "expected"; still match discontinued ones but say "no longer made".
   - Size: shown from FDA only, never pass/fail ("not measured").
4. API routes:
   - GET /api/lookup?ndc=… or ?q=ibuprofen 200 mg tablet → products summary (debug).
   - POST /api/verify (JSON label + pill reading, i.e. what phase 2's vision will produce) → full result. Zod-
     validate input; friendly errors.
5. ResultView component (src/components/result-view.tsx), built to DESIGN.md — this is the screen judges
   remember, make it stunning: VerdictField; side by side "What the FDA says it should look like" (PillDrawing of
   expected or matched product) and "What's in your bottle" (for now a PillDrawing from the typed pill; phase 2
   swaps in the photo); FeatureTable (Imprint, Color, Shape; Size = FDA value, "not measured"); identifiedAs line;
   "Other side: …" when the FDA imprint has two sides; SourceBadge(s) with DailyMed link + published date;
   "Checked against FDA data on <date>"; for SAME_MEDICINE show the maker ("Made by L. Perrigo Company").
   Use it on /samples too (replace the static cards' verdict area with real computed results from fixtures).
6. Dev page /dev/check (not linked from nav, noindex): form for label NDC or drug+strength, plus pill imprint,
   colors, shape, confidences, optional guess → calls /api/verify → renders ResultView. Prefill buttons for the
   3 demo scenarios:
   a) MATCH: label NDC 0113-0517 (I2 orange oval), pill "I2", orange, oval.
   b) SAME MEDICINE: label NDC 0573-0160 (Advil), pill "I2", orange, oval.
   c) MISMATCH: label "Ibuprofen 200 mg tablet" (no NDC), pill "L484", white, oval/capsule, guess acetaminophen
      500 mg → identifiedAs acetaminophen 500 mg.
7. Tests (vitest, network-free): record trimmed real JSON from RxNav for rxcui 310965, rxcui 198440, NDC 0113-0517
   and 0573-0160 into src/lib/fda/__fixtures__/ (note the date + URL). Aim ~40+ tests: NDC formats, imprint
   tokenizing/normalizing/confusables/side order/stoplist, color + shape closeness, every verdict rule incl. the
   3 demo scenarios, low confidence, missing data, discontinued products, API input validation.
   Also `npm run smoke:fda` that hits the LIVE APIs for the 3 scenarios and prints verdicts + timings. Run it and
   paste the output in the handoff.
8. Update CheckingSteps copy step 4 to "Comparing with FDA records". Screenshots (375 + 1440) of /dev/check for
   all 3 scenarios + /samples → docs/screenshots/phase-1/. Fix anything not beautiful.
9. If Vedhanth has connected the GitHub repo to Vercel, run `vercel git connect` so pushes auto-deploy.
10. Codex review, fix real findings, commit, push, deploy to production. HANDOFF entry at the TOP of HANDOFF.md.

## Done when
The 3 demo scenarios return MATCH / SAME_MEDICINE_DIFFERENT_MAKER / MISMATCH (with identifiedAs) from LIVE FDA
data in production via /dev/check; tests/build/lint pass; smoke output in the handoff; screenshots saved.

## How to test
1. Production /dev/check → each prefill → correct verdict, real FDA drawings, DailyMed link opens the right label.
2. Change scenario a) imprint to "12" (one↔I confusion) → still MATCH (close); set imprintConfidence 0.4 → UNSURE.
3. Scenario a) with color "white" → UNSURE with the reason "color doesn't match".
4. /api/lookup?ndc=0573-0160 returns the Advil product; ?ndc=garbage returns a friendly 400.
5. Second identical request is visibly faster (cache); Redis keys start with "sl:".

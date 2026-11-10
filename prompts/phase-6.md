# Phase 6 — Safety fix, honest research story, demo-proofing, one-page PDF, final polish

Read first (as always): AGENTS.md and everything it lists, the newest HANDOFF.md entry (phase 5), research/REPORT.md
and INTERPRETATION.md, git status + log. Plan in 3–5 bullets first.

## Decisions from the architect + planner (Nov 10)
- Vedhanth ACCEPTS the phase 5 release as an honest result ("merge"). Merge feat/phase-5 into main first (if not
  already), deploy, and confirm production. The coverage goal was not met; we say so openly.
- No more paid research runs. Remaining API credit is for the live app, demo and video only. Spend cap this phase: $1.
- After this phase: FEATURE FREEZE. Only bug fixes after this.

## Tasks
1. Safety fix (the holdout wrong pass: lisinopril "5" passed as ropinirole alt "598;S" via 5↔S folding + visible subset):
   - A pass (MATCH or SAME_MEDICINE_DIFFERENT_MAKER) must never rest on a look-alike-folded match of a short token.
     Rule: tokens of 1–2 characters can only match EXACTLY. A visible-subset (partial) match that needs folding →
     UNSURE. Keep everything else unchanged.
   - Unit tests: reproduce the exact holdout case (must be UNSURE now), plus I2 vs "12" (still close/allowed only
     where the existing rule allowed it for full matches), "L484" vs "1484", single-char tokens, partial subsets.
2. Two-view merge: colors that are "close" (same closeness rule the single-view matcher already uses) count as
   agreeing; only "different" colors/shapes conflict → UNSURE. Tests.
3. Re-score from CACHED readings only ($0, zero model calls, ANTHROPIC_API_KEY unset): development set and holdout,
   one view and two views. Save as research/out/post-fix-*.json and add a clearly separate section to REPORT.md and
   /research: "After two fixes (post-hoc — this holdout is no longer untouched)". The FROZEN holdout numbers stay the
   headline. Never present post-fix numbers as a fresh test.
4. /research story (plain words, judges skim): headline = frozen holdout. Then three short points with numbers:
   (a) direct AI also said "can't tell" ~69% → these 2016 single-side photos are hard for any method;
   (b) when Second Look answers it's right 83/88 vs 83/94, with 4 vs 9 false alarms and 1 vs 2 wrong pills passed;
   (c) the fresh test found a real safety bug; we fixed it and show before/after. Keep the full tables + links below.
   Fix the research buttons to point at main (now that phase 5 is on main).
5. One-page PDF (required by DSH): page /one-pager (noindex) with print CSS, exactly ONE US Letter page, built to
   DESIGN.md (same fonts/colors, no hairline borders): title + one-line pitch; the problem (Flynn 51.5M, Kesselheim
   34%/66%, with citations); how it works (label photo → pill photo → AI reads → FDA records → code decides) as a
   small diagram; 2 small screenshots (result + drawn pill); real data sources (DailyMed, RxNorm, NIH); research box
   with the frozen holdout numbers + "found and fixed a safety bug"; safety line; live URL + GitHub + QR code to the
   app. Export to public/second-look-one-pager.pdf (headless Chrome print) and docs/. Plain human words, no hype.
6. Demo-proofing:
   - If test-images/real/* photos exist, run `npm run samples:build`, commit, deploy; otherwise leave as is and say so.
   - Every page: favicon (amber bottle mark), page titles, meta description, Open Graph image (1200×630, drawn pill
     + "Is this the right pill?") so links look good on Devpost/Discord. Friendly 404.
   - Accessibility pass: CheckingSteps announced via aria-live, verdict has an accessible name, all inputs labelled,
     focus order sane, color contrast AA. Lighthouse accessibility ≥ 95 on /, /check, /type, /samples, /research.
   - Production smoke: home → sample live check → result; /type match + mismatch; /check with a real NIH photo end to
     end (one live call, within the $1 cap). Note timings.
7. Tests (keep all 190+ green + new ones), lint, tsc, build, self/Codex review, screenshots of /research, /one-pager
   and the OG image → docs/screenshots/phase-6/. Push to main; verify production.
8. HANDOFF at the TOP of HANDOFF.md (BUILDER line): fix details, post-fix numbers (labelled post-hoc), PDF path,
   Lighthouse scores, production smoke results, spend.

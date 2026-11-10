# Phase 5 — Fewer "we can't tell"s, proven on fresh photos

Read first (as always): AGENTS.md and everything it lists, the newest HANDOFF.md entry (phase 4), research/REPORT.md,
git status + log. Plan in 3–5 bullets first. Branch feat/phase-5; push to main only when everything below passes.

## The problem (from phase 4, Sonnet pipeline, 400 pairs)
Safety is excellent: 0 wrong pills passed, 2 false alarms, and when it gave an answer it was right 141/143 times.
But it says UNSURE 257/400 times, and only 64/200 right pills pass. Sonnet couldn't read an imprint on 54/200 photos
and had 8 reader errors (overlong strings rejected). Goal: cut UNSURE a lot while keeping wrong-passes ≈ 0.

## Research hygiene (non-negotiable)
- The phase-4 cohort is now the DEVELOPMENT set. You may study it and tune on it. Label its numbers "development".
- Freeze the code (record the commit hash), THEN run a brand-new HOLDOUT cohort ONCE: new seed, products (NDCs) that
  do NOT appear in the dev set. Never change code after seeing holdout results. If you must fix a bug afterwards,
  say so in the report and keep both runs.
- Holdout numbers become the headline. Total new spend cap: $5 (print running cost; reuse every cached reading).

## Tasks
1. Diagnose (dev set, no new model calls): for every UNSURE and every no-read, record the reason (no imprint read,
   imprint on the other side per the FDA record, partial imprint, color disagrees, shape disagrees, reader error,
   discontinued/no FDA data…). Write research/out/dev-diagnosis.md with counts and 10 example rows. Fix the plan
   based on what it actually shows — don't guess.
2. Two-sided check (product + engine):
   - Engine: accept readings of BOTH sides of the same pill and merge them before matching (union of imprint sides;
     colors/shapes must agree across both photos, otherwise UNSURE). Unit-test heavily, including hard look-alikes.
   - /check: after the pill photo, if the imprint wasn't read, was partial, or the FDA record shows text on the
     other side, ask: "Flip the pill over and take one more photo" (one tap to skip). The result shows both photos.
     /type already has "Other side".
   - Research: if the NIH data has a second photo of the same pill/product, evaluate "both sides" as its own method.
3. Reader robustness: never hard-fail on long/odd strings — clean and truncate, keep what's readable, lower
   confidence if trimmed. Tighten the pill prompt only where the diagnosis shows a problem (e.g. "copy exactly what is
   stamped; if a side is blank say blank"). Bump the prompt version (pill-v2). Re-read the dev set with pill-v2 only
   if the cap allows; otherwise rely on the holdout.
4. Optional rule, only if the dev data supports it: MATCH on a matching visible side + exact color + exact shape when
   the other FDA side can't be seen. Adopt it ONLY if it causes ZERO wrong passes on all dev hard look-alikes; otherwise
   leave it out and say so.
5. Holdout run (after freezing): ~150 photos / 300 pairs, same pair rules (≥ 80% hard look-alikes among wrong pairs),
   Sonnet pipeline (one side), Sonnet pipeline (both sides, if available), direct-Sonnet baseline. Haiku optional.
6. New metrics, for every method, always shown together (never one without the others):
   - wrong pills caught, wrong pills called fine (wrong passes), false alarms, right pills passed,
   - "when it gave an answer, how often it was right" (decisive accuracy) and coverage (% not UNSURE).
7. Update /research (headline from the HOLDOUT, safety-first but honest, e.g. "On N fresh photos, Second Look called
   X wrong pills fine; when it answered it was right Y of Z times; it said 'can't tell' W% of the time"), dev vs
   holdout clearly separated, charts updated, REPORT.md, README, home line. Plain words.
8. Tests (keep all 142+ green), self-review/Codex review, screenshots of /research and the new flip step at 375 + 1440
   → docs/screenshots/phase-5/, push to main, production checks.
9. HANDOFF at the TOP of HANDOFF.md (BUILDER line): dev diagnosis summary, what changed and why, frozen commit hash,
   holdout table, spend, anything surprising. If usage runs low: "Stop and hand off" rules apply.

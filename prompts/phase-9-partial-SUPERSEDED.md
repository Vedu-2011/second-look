# Phase 9 — "Check another pill from this bottle" (small, safety-motivated; planner-authorized exception to the freeze)

Read first (as always): AGENTS.md and everything it lists, newest HANDOFF.md entry, git status + log. Plan in 3 bullets.
Do this AFTER phase 8 is merged and the phase-8 addendum is done. Branch feat/phase-9-more-pills; preview first;
merge only when Vedhanth says "merge".

## Why
A refill can contain mostly right pills and ONE wrong pill (e.g. a returned pill mixed into stock). We check one
pill at a time, so we must make checking more pills effortless and tell people what to look for.

## Tasks
1. "Check another pill from this bottle" button on every photo result (all 4 verdicts): reuses the SAME label
   reading (server-owned continuation like the flip step: random id, sl:bottle:<id>, 30-minute TTL, never trust a
   client-sent label), asks only for a new pill photo (+ optional flip), runs the same engine. No new AI call for the
   label. Expired/forged ids → friendly "please photograph the label again".
2. Bottle summary at the top once ≥2 pills are checked: "3 pills checked from this bottle: 2 match · 1 doesn't match"
   with small thumbnails/verdict dots. Bottle-level rule: if ANY pill is MISMATCH → the summary shows the red
   "Don't take any pills from this bottle until you talk to your pharmacist." If any is UNSURE and none MISMATCH →
   neutral "Some pills couldn't be checked." Individual results stay visible. No photos stored server-side.
3. Guidance card on every result (calm, short): "Pour the pills onto a plate. Do they all look the same? If any pill
   looks different, check that one too." Also in the /check tips. /type gets a "Check another pill" too (typed).
4. Cap: max 10 pills per bottle session; counts against the existing rate limit and daily cap.
5. Tests: continuation reuse/expiry/forgery, bottle summary rule (any mismatch → red), cap, typed path. All
   232+ green, Lighthouse a11y 100 on /check and /type, DESIGN.md v2 styling, screenshots 375 + 1440 of a 3-pill
   summary with one mismatch → docs/screenshots/phase-9/.
6. Add to docs/DEVPOST.md "What's next": "Whole-bottle check: spread the pills out, take one photo, and Second Look
   checks every pill and points at the odd one out." (planner wording — don't change it)
7. Free smoke on the preview (mocked AI ok) + at most one live check ($0.05 cap). HANDOFF at the top with PREVIEW url.

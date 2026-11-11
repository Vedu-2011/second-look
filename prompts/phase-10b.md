# Phase 10b — real-photo re-run, safety review, polish (before merge)
Builder: Claude Code. Branch feat/phase-9-bottle. Do NOT merge. Codex is out of usage, so the review is yours —
done by a FRESH subagent that hasn't seen your phase 9/10 work (so the work isn't grading itself).

## 1. New real photos (closer, sharper) — re-run live (PAID-API LOCK, cap $0.50, note $)
Vedhanth re-shot everything on the dark paper, phone closer:
- test-images/real/mismatch/pill.jpg = "93" (closer), pill-back.jpg = "2263" (closer)
- test-images/real/bottle/pills.jpg = 9 × "G 12" + amoxicillin "93" face up, in the middle
- test-images/real/bottle/pills-flipped.jpg = SAME spread, only the amoxicillin flipped in place ("2263" up);
  the whole layout shifted slightly between shots (real handheld retake)
- test-images/real/extra/bottle-93-upside-down.jpg = same spread, "93" rotated 180° (extra test)
Run: samples:build for mismatch; check:flip on the new 93 → 2263 pair; a live bottle check on pills.jpg; then a
REAL "flip and snap again" follow-up using pills-flipped.jpg as the second photo (position matching on a real
handheld retake — this is the first real test of it). Expected: bottle RED with the amoxicillin flagged and 9 MATCH;
after the follow-up the wrong pill is named Amoxicillin 500 mg; only that pill re-read. Save these real results as
the samples / screenshots the video will use. Report honestly if anything differs; fix real bugs only, never tune
thresholds or prompts to these photos.
Also: is a "93"/"2263"-up pill with MISMATCH already red without flipping? (It should be — either-side rule.) If the
result asks to flip only to NAME the pill, the wording should make that clear: "Pill 5 is not your metformin. Flip it
if you want to know what it is." (or similar plain wording) — red stays red either way.

## 2. Safety review (fresh subagent, read-only) — checklist in prompts/review-phase-9-10.md
Spawn a separate reviewer subagent with only that checklist + `git diff main...feat/phase-9-bottle`. It reports
findings (file:line, failure scenario, fix). You then fix the real ones, with tests. List every finding and what you
did in the handoff (fixed / not a bug + why).

## 3. Polish
- Legend under the bottle photo: no lonely wrap of "? Can't tell" at 1440 (and check 375).
- Result screen must read well on a projector (1920) — check the red bottle result and the after-flip result.

## Checks
Tests, lint, tsc, build pass. Screenshots 375 + 1440 (+1920 for the two hero results) in docs/screenshots/phase-10b/.
Push to the preview. Handoff to ~/Hackathons/_coord/handoffs/, BOARD row in/out, run tidy.sh.
Do not rename the folder — the planner will do that after this phase.

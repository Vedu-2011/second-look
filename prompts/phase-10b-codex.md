# Phase 10b (Codex) — real-photo re-run + safety review + fixes + polish, before merge
Builder: Codex. Claude Code is NOT working (out of usage), so the home folder "DSH Hacks V2" and branch
feat/phase-9-bottle are yours. Add your BOARD row. Do NOT merge.
Read first: ~/Hackathons/CLAUDE.md, ~/Hackathons/_coord/BOARD.md, the two newest handoffs in _coord/handoffs/
(Claude Code's phase 8 addenda + phase 10), then prompts/phase-10b.md and prompts/review-phase-9-10.md.
Your usage window is short: work in this ORDER, commit + push after each step, and if you're about to run out,
stop at a safe point and write a PARTIAL handoff (CLAUDE.md "Two builders" section).

## Step 1 — real photos (= phase-10b.md section 1). PAID-API LOCK, cap $0.50, note $.
New close-up photos are in test-images/real/: mismatch/pill.jpg ("93"), mismatch/pill-back.jpg ("2263"),
bottle/pills.jpg (9 × "G 12" + amoxicillin "93" up), bottle/pills-flipped.jpg (same spread, only the amoxicillin
flipped in place to "2263", handheld retake), extra/bottle-93-upside-down.jpg. Run everything section 1 lists,
including the first REAL "flip and snap again" follow-up with pills-flipped.jpg. Expected: bottle RED, amoxicillin
flagged, 9 MATCH; after follow-up it's named Amoxicillin 500 mg and only that pill was re-read. Save the real
results as samples/screenshots for the video. Report honestly; never tune thresholds or prompts to these photos.

## Step 2 — safety review (= prompts/review-phase-9-10.md checklist)
You didn't write phase 10 (Claude Code did), so review `git diff main...feat/phase-9-bottle` with fresh eyes
(`codex review` against main is fine). List every finding ranked by severity: file:line, failure scenario, fix.

## Step 3 — fix the real findings, with tests
Fix every real safety/correctness finding (green when it shouldn't be, wrong pill carried across flip-and-snap,
quota bypass, photo privacy, frozen research numbers changed). For each finding say in the handoff: fixed (+test)
or not a bug (+why). Don't change the frozen single-pill benchmark behavior.

## Step 4 — polish (= phase-10b.md section 3)
Legend under the bottle photo: no lonely "? Can't tell" wrap at 1440/375. Red bottle result + after-flip result
readable at 1920 (projector).

## Done
Tests, lint, tsc, build pass. Screenshots in docs/screenshots/phase-10b/ (375 + 1440, +1920 for the two hero results).
Push to the preview. Handoff file in ~/Hackathons/_coord/handoffs/ (BUILDER: Codex), BOARD row → Done,
run `bash ~/Hackathons/_coord/tidy.sh`. Don't rename the folder (planner does that after).

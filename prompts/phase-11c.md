# Phase 11c — piles work + a clean result screen (last feature before the video; Vedhanth approved)
Builder: Claude Code (Vedhanth's pick; Codex is fine too). New branch fix/piles from main. Preview only; merge on "merge".
Read BOARD + newest handoff first.

## What happened (Vedhanth, production, Nov 12 12:03 AM)
Ibuprofen label + 9 teal softgels + 1 Tylenol poured in a PILE on a wood table (realistic: that's how people pour).
Result: one separate softgel = pill 1 ✓; everything else (8 softgels + the Tylenol) was ONE big dashed circle.
- No coaching appeared: captureCoaching only says "Spread them out" when clumps.length >= 2. One huge clump of ~9 pills
  slipped through, and the paid check ran anyway.
- The result led with "1 pill matches" (green-feeling row "1 pill matches your label", legend shows only "✓ Matches").
  Not green — safe — but it reads like a near-pass while 90% of the bottle, including the wrong pill, was never checked.

## Fixes
Vedhanth (Nov 12): "I don't want them to need to be spaced out." Real people pour a pile. Piles must WORK, not just
get a nicer error. Coaching to spread out is no longer the plan.

### 1. Read the pile — "group reader" for touching pills (NEW, bottle mode only)
Classical segmentation stays exactly as is for separate pills (it's proven). For every touching/clump region:
- Crop the region (with padding, full resolution) and send it to the same Sonnet model with a NEW, separate prompt
  `read-pill-group` (do not edit read-pill.ts / pill-v3; the single-pill engine stays frozen). It returns one entry per
  pill it can see in the crop: approximate center + box (normalized to the crop), the same fields read-pill returns
  (imprintSides, imprintConfidence, colors, shape, confidences, photoProblems), plus `partlyHidden: boolean`, and a
  top-level `pileCount` + `countConfidence` + `somePillsMayBeHidden: boolean`.
  Strict schema via tool use, like read-pill. Report only what's visible; never guess hidden pills' imprints.
- Each entry becomes a normal BottlePill (numbered, pin at its center mapped back to photo coordinates) and goes through
  the SAME engine per pill → MATCH / SAME / MISMATCH / UNSURE. Flag them `fromPile: true`.
- partlyHidden pill or imprintConfidence < 0.7 → UNSURE as usual (double-read still applies).
- Safety: a photo with any pile can NEVER be solid green "All match" — at best "Looks right", with the line
  "Some pills were touching. We read N in the pile; a pill hidden under another can't be seen." If
  somePillsMayBeHidden is true or countConfidence is low → UNSURE with "Some pills may be hidden under others — give
  the pile a shake and snap again." MISMATCH from a pile pill → red exactly like any other pill.
- Cost: one group read per pile region (max 3 per photo), counted in the quota like 5 pill reads each. Cache by
  image hash like the other readers. Tests with mocked readers + 2 real smoke runs (see Checks).
- Remove the "Spread them out" PRE-CHECK block: the check runs normally. Keep "Move closer" (too far really fails).
  Tips text on the camera screen: "Pour them out. Try not to stack pills on top of each other."

### 2. Wording when a pile couldn't be fully read
Lead with the problem, not the match: e.g. "We could read 6 of about 10 pills. Some are hidden under others — give
them a shake and snap again." Never lead with "1 pill matches" when most of the photo is unread.

### 3. Legend lists every mark that appears, including the dashed circle → "Not read". Any unread region → never
MATCH / LOOKS_RIGHT (test).

## Second test, same night (spread out, wood table, phone ~1.5 ft up) — the ANSWER was right, the screen was a mess
Result: pill 6 (Tylenol) red ✓ correct, so the bottle was red. But Vedhanth's reaction: "this is so ass". Why:
- Number badges are huge (bigger than the pills) and sit ON the pills, overlapping each other — you can't see the pills.
- When the bottle is already red, the screen still shows 5 kinds of marks (✓ ? ↻ ! ×) and asks about face-down/unsure
  pills that no longer matter.
- Pill 8, a real IB 200 softgel, got "! looks different" (shape, from a tilted shiny capsule).
- A dark object cut off at the right edge got a circle.

5. Markers: small pins (~26–28px on phone, number + symbol), anchored just OUTSIDE the pill's edge, pushed apart so they
   never overlap each other or cover a pill. Tap a pin or a pill to open its row. Optional: pinch-zoom on the photo.
6. Red mode: when any pill is a MISMATCH, the screen is about that pill only. Big red card → the wrong pill's row →
   one line "The other N pills: X match, Y not fully checked — it doesn't matter now, this bottle has a wrong pill."
   Non-red markers dim to small gray dots (✓ stays visible). No flip/face-down asks except "flip pill 6 to identify it".
7. Shape-only "looks different" on a pill whose imprint is CONFIRMED: show ✓ with a small note "Looked a little
   different in shape — probably the angle." instead of "!", because 2D shape from a tilted capsule is unreliable.
   Size or color odd, or unconfirmed imprint → unchanged ("!"). Bottle verdict rules otherwise unchanged. Tests.
8. Edge cutoffs: a cutoff region that's mostly outside the photo and much darker than any detected pill can be shown as
   a small note ("something at the edge wasn't checked") instead of a big circle — still never green.

## Checks
Unit tests for every numbered item (mocked readers). Tests, lint, tsc, build pass.
Paid smoke (PAID-API LOCK, cap $0.40): (a) the real metformin bottle bottle/pills.jpg must still be RED with pill "93"
flagged — no regression; (b) a real PILE: if Vedhanth has dropped test-images/real/extra/pile-*.jpg use those, else
extra/user-test-ibuprofen-tylenol.jpg (its touching pair). Report honestly what the group reader saw (count, readings).
Screenshots 375 + 1440: pile result, red-mode result. Push preview, do NOT merge. Handoff to
~/Hackathons/_coord/handoffs/, BOARD in/out, tidy.sh.

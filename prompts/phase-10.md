# Phase 10 — "Pour and snap": make the whole-bottle check work the way older users will actually use it
Builder: Claude Code. Branch: keep working on feat/phase-9-bottle (one preview, one merge later). Do NOT merge.

## Why
The people this is for (older adults, caregivers) will pour the pills onto a counter, take ONE photo and expect an
answer. They will not flip ten pills or arrange them neatly. Today the bottle check fails the whole photo if two
pills touch, and any pill that lands blank side up makes the bottle "couldn't be read — flip those pills".
Goal: one photo gives a useful answer most of the time, and when we need more, we ask for the SMALLEST possible
extra step (flip 1–2 circled pills IN PLACE and snap again), never "flip everything".

Safety rules don't change: the engine still owns every per-pill verdict; green only when every detected pill is
confirmed by its imprint; never claim we checked pills that aren't in the photo; frozen research numbers untouched
(these are bottle-level rules, separate from the single-pill benchmark — say so in the research note).

## 0. First: verify with Vedhanth's real photos (paid, take PAID-API LOCK, cap $1, note $ in the handoff)
Real photos are now in test-images/real/: match/pill.jpg ("G 12"), different-maker/pill.jpg (Kirkland "IB 200"
softgel, teal), mismatch/pill.jpg ("93") + pill-back.jpg ("2263"), bottle/pills.jpg (9 × "G 12" + 1 amoxicillin
showing "2263", on dark paper). Label photos (label.jpg) may or may not be there yet — if missing, use the matching
/labels values typed in (the single-pill flow and smoke script support typed labels) and say so.
Run `npm run samples:build` (or the per-scenario live check) and one live bottle check on bottle/pills.jpg.
Record what each pill read as and its verdict. Expected: MATCH · SAME_MEDICINE_DIFFERENT_MAKER · MISMATCH + flip
ask → MISMATCH identified amoxicillin after "2263" · bottle RED with the 2263 pill flagged, 9 others MATCH.
If any differ, report honestly; fix only real bugs (not tuning to these photos). Also test
test-images/real/extra/three-pills-close.jpg as a bottle photo with the metformin label (expect RED: 93 + Tylenol).
Commit extra/three-pills-close.jpg and extra/tylenol-close.jpg; delete extra/metformin-far.jpg,
extra/tylenol.jpg, extra/three-pills-93-g12-tylenol.jpg (blurry/far — not useful). Don't commit the labels PDF.

## 1. A wrong pill is caught from EITHER side (confirm + test)
Any readable text that isn't part of the label medicine's FDA imprint = MISMATCH for that pill, whichever face is
up ("93" alone or "2263" alone vs metformin → red). Make sure the bottle flow does this (it should via the engine)
and add tests with recorded readings. Only the per-pill identification needs both sides — the alarm doesn't.

## 2. Look-alike groups inside the photo (no AI, from segmentation)
For each detected pill compute simple features from the crop/mask: length, width, aspect ratio, area relative to
the median pill, mean color (Lab), and whether a score line is visible if cheap. Group pills that are near-identical.
- Odd one out: a pill clearly unlike the main group (size/shape/color) gets flagged even if unreadable:
  "Pill 7 is a different shape and size from the others." → bottle WARNING at least (never green), and it's the
  first pill we ask about. Size is relative within the photo (no ruler needed). If the label's FDA record has a size,
  you may also compare the main group's aspect ratio to it, but never call a pill "right" from size alone.
- Blank side up: a pill whose face is blank AND whose label product has a blank side in FDA data, AND that matches
  the group of imprint-confirmed pills, gets a new per-pill state "looks like the others, writing is face-down"
  (UI wording, not a new engine verdict). It is NOT confirmed. Bottle can't be green while any exist.
- Pick thresholds from synthetic tests + the dev composites, not from Vedhanth's demo photos. Document them.

## 3. New bottle outcome wording (plain, calm, short)
- All confirmed → green: "All 10 pills we found match your label." (+ "Check every pill has a number.")
- Any MISMATCH → red (unchanged).
- Odd one out, unreadable → yellow: "Pill 7 looks different from the others. Flip just that one and snap again."
- Only face-down look-alikes left → a new calm state (not alarming yellow): "9 pills match. 1 has its writing
  face-down — flip pill 4 where it is and snap again to finish." Primary button: "Flip and snap again".
Max 3 pills ever asked to flip; if more are unreadable say "Give the pills a gentle shake, pour again, snap again."

## 4. "Flip and snap again" — re-check only what's needed
Second photo of the same spread after flipping the circled pills in place. Match pills between photos by position
(normalize by the overall layout; centroids barely move). Re-read ONLY the flipped pills (AI) and reuse earlier
results for the rest (no new AI calls for them). If matching is ambiguous (pills moved a lot, count changed), fall
back to a fresh full check and say so plainly. Combine into one result; the saved/shared result shows the final state.
Quota: a re-snap counts as max(1, ceil(rereads/5)) like today.

## 5. Real-life capture
- Touching pills: don't fail the whole photo. Check every pill that IS separate, circle the clumps on the photo and
  say "Some pills are touching — nudge the circled ones apart and snap again." Partial results stay visible.
  Clumps can never be green.
- Background tips on the camera screen, short: "Pour onto something dark, like a towel or plate. Spread them out."
- Make the whole-bottle check the default on /check (big "Check my pills" button); single pill stays one tap away.
  Mobile-first, big text (≥18px body on result), 44px targets. Projector-readable at 1920.

## 6. Small leftovers
- /one-pager: replace the old orange ibuprofen / L484 example and "507 versions of ibuprofen" with the final demo
  (metformin "G 12" bottle, amoxicillin "93/2263" look-alike). Keep it honest; no new stats unless sourced.
- README + DEVPOST "What it does": one or two plain sentences on pour-and-snap and flip-only-what-we-circle.

## Tests / checks (all must pass)
Unit: odd-one-out, face-down look-alike, either-side mismatch, position matching (moved/flipped/added/removed pill),
partial clumps, outcome wording. Build, lint, tsc. Screenshots 375 + 1440 of: green bottle, red bottle (real photo),
face-down state, odd-one-out, touching clumps, after flip-and-snap. Live paid runs only under PAID-API LOCK, ≤ $1
total for this phase. Self-review your diff; run `codex review` only if Codex has usage (it's nearly out — skip
otherwise and say so). Push to the preview. Handoff to ~/Hackathons/_coord/handoffs/, BOARD row in/out.

# Phase 11b — undo the segmentation regression, then feature freeze
Builder: Claude Code (Codex did 10c + 11, so Claude Code gives a fresh pair of eyes). Branch feat/phase-10c-polish.
Read BOARD + Codex's phase 11 handoff first. Preview only; merge only when Vedhanth says "merge".

## Why
Phase 11's new segmentation (chroma cue + touching-pill split) passed synthetic tests but did WORSE on the only real
photo we have (user test: 6 numbered + 4 unchecked before → 4 + 5 after). An unproven change that regresses on real
data doesn't ship 3 days before the deadline.

## 1. Revert ONLY the segmentation change
- segment.ts (and split-touching.ts wiring) back to the pre-phase-11 behavior (78bfa98). Keep split-touching.ts in the
  repo but not wired in (note it in ARCHITECTURE as "not shipped: regressed on real photo").
- KEEP everything else from phase 11: consensus / "Looks right", double-read, free coaching, quota changes, display.
- Free, deterministic (no AI): run the segmenter on every real photo in test-images/real/ (bottle/pills.jpg,
  bottle/pills-flipped.jpg, extra/*.jpg). Table: pills numbered / unchecked regions, before (phase 11) vs after revert.
  Expected: user test back to 6 + 4; metformin bottle 10 + 0 (if not, report it).
- Coaching thresholds were tuned on synthetic data with the old segmenter in mind — confirm the user-test photo still
  gets "Spread them out" (or "Move closer") and the metformin bottle gets no coaching.

## 2. Small wording fix (display only)
In a MISMATCH row whose pill was identified, lead with the imprint, e.g. pill 5 in the real metformin bottle:
"Its print says 93 / 2263 — that's Amoxicillin 500 mg, not your Metformin." The "different color from the others" line
comes after, not first. Single unreadable side: "Its print says 93 — that's not on any metformin 1,000 mg."

## Checks
Tests, lint, tsc, build pass. No paid calls. Screenshots 375 + 1440 of the real metformin bottle before/after shares
and the user-test result. Push to the preview. Handoff to ~/Hackathons/_coord/handoffs/, BOARD in/out, tidy.sh.
After this: FEATURE FREEZE. Only bug fixes, video, Devpost and deck from here.

# Phase 11e — every mark must sit ON its pill (safety bug in the pin layout)
Builder: Claude Code or Codex. Branch fix/piles (continue). Preview only; merge on "merge". Read BOARD + newest handoff.
Vedhanth's phone screenshots: docs/screenshots/phase-11e/vedhanth-pins-bug-{overlay,row}.png (preview, Nov 12 4 AM;
Advil label, ~14 teal softgels in loose piles + 1 Tylenol on wood).

## What was right
Bottle RED; pill 5 = "TYLENOL 500 — that's Acetaminophen 500 mg, not your Advil." Correct answer. No false reds.

## What's wrong (must fix before merge)
1. SAFETY: the red "5 ×" pin sits next to a SOFTGEL (the dashed one at left), not next to the Tylenol. Someone would
   throw out the wrong pill. The phase 11c `layoutPins` "push apart" moves pins away from their pills.
2. ~12 gray dots float in empty wood, far from any pill. You can't tell which dot belongs to which pill.
3. Two single, separate-looking softgels have dashed "Not read" circles. Find out why (pile cap of 3? cutoff? group
   reader returned nothing?) and report in the handoff.

## Fix: mark the pill itself, not a floating pin
- Draw each pill's mark ON the pill: a ring/outline that follows the pill's own detected box/mask (rounded rect rotated
  to the pill), 3px, colored by state: red (doesn't match), soft green (matches / matched earlier), gray (not fully
  checked), dashed orange (not read). The wrong pill gets a THICK red ring + subtle red glow. Nothing else is red.
- Number tag: a small chip (≈22–26px) that TOUCHES the pill's ring at the ring point nearest the photo's open space.
  If chips would collide, shrink to a number-less dot and keep the number in the row list. A chip may never be closer
  to another pill than to its own pill (test this invariant: for every chip, nearest pill = its own pill).
- Red mode: only the wrong pill keeps its number chip; others show rings only (no chips), dimmed.
- Pile pills: rings at the group reader's mapped box. If that box is too uncertain to draw, don't draw a ring for that
  pill (count it in the summary text instead) — never draw a mark on a guessed spot.
- Share page (no photo): same rule with the soft pill shapes.
- Tapping a ring or chip opens that pill's row (as now).

## Checks
Unit test for the invariant above over the saved real results (metformin bottle, user-test pour, the 11c/11d piles)
and synthetic crowded scenes. Screenshot assertions: wrong pill's ring encloses the wrong pill's center; every chip's
nearest pill is its own. Free (replay saved results). Screenshots 375 + 1440 incl. a crowded pile.
Tests, lint, tsc, build. Push preview. Handoff, BOARD, tidy.sh.

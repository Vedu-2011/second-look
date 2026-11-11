# Phase 11 — "common sense" for a real pour: look-alike consensus, double-read, translucent softgels
Builder: Codex if it has usage (segmentation + engine work), else Claude Code. Branch: continue on
feat/phase-10c-polish (not merged yet; we'll merge 10c + 11 together). Preview only, do NOT merge.
Read BOARD + newest handoff (Codex phase 10c) first.

## What happened (Vedhanth's real test, Nov 11, on production)
Ibuprofen 200 mg capsule label (NDC 69452-212, Bionpharma) + 9 Kirkland "IB 200" teal softgels + 1 Tylenol,
poured onto dark paper, photo from ~1.5 ft. Result: Tylenol correctly RED. But only 6 pills got numbers; 4 softgels
were dashed (touching/clumped, unchecked); pill 2's crop clearly shows "IB 200" yet came back "We can't tell (we
think it says IB 200)"; pill 1 "no readable imprint" (writing face-down / on its side).
Vedhanth: "make it have common sense — all 9 blue oblong pills look the same, so they're probably the same."
If he has sent the original photo, it's at test-images/real/extra/user-test-ibuprofen-tylenol.jpg — use it as a
real test case, never as a tuning target.

## 1. Look-alike consensus (the "common sense" rule) — bottle level, honest wording
Pharmacists do this by eye: pills that look identical to ones you've confirmed are probably the same medicine.
- Within the main look-alike group (lookalike.ts), if ≥ 2 pills are imprint-confirmed (MATCH / same medicine), no pill
  in the group has a conflicting reading, and no MISMATCH anywhere: every unconfirmed pill in that group gets a new
  display state "Looks like the confirmed ones" (soft green outline, distinct from a solid confirmed check).
  A partial reading that's consistent with the label imprint ("IB 2", "200") strengthens it; a conflicting partial
  reading ("IB 1", "93") blocks it and stays "?" / "!".
- New bottle outcome when every pill is either confirmed or "looks like the confirmed ones", and nothing is odd,
  clumped, cut off or mismatched: soft green "Looks right". Title: "These pills look like your ibuprofen."
  Body: "We read the print on 4 of 10. The other 6 look the same as those. Ask your pharmacist if anything looks off."
  It is NOT the solid green "All match" — that stays reserved for every pill read. Never use consensus when any
  pill is red, odd, clumped or cut off.
- Safety notes (keep the earlier rules): consensus never overrides MISMATCH; carried results from an earlier photo
  can't be consensus "confirmers"; a single confirmed pill is not enough.

## 2. Double-read for borderline crops (bottle mode only)
Real photos keep coming back at 0.6 imprint confidence for print that is plainly visible (IB 200, G 12, 93). The
single-pill engine/threshold (IMPRINT_MIN_CONFIDENCE 0.7, verdict-engine.ts) stays frozen.
In the bottle flow only: if a crop's reading is 0.5–0.69, read that crop once more independently (same reader,
slightly different crop padding or a 2× upscale). If both readings give the same normalized imprint, treat it as
agreed (meets the threshold, record "read twice, same result" in evidence). If they differ → stays "?".
Budget: at most 5 extra reads per bottle, counted in the quota; deterministic tests with mocked readers.

## 3. Translucent softgels + touching pills (segmentation)
- Translucent teal/blue/green gels on dark backgrounds: add a color/saturation cue to the foreground model (they're
  low in lightness contrast but high in chroma). Tests with synthetic translucent gels on dark gray + the dev set.
- Two touching pills: try to split before giving up (distance transform / watershed on the merged blob, accept only if
  it yields two convex pill-shaped parts of similar size). Otherwise keep the dashed "nudge apart" behavior.
- Don't change thresholds to fit Vedhanth's photos; pick them from synthetic tests, document them.

## 4. Capture coaching (before the paid read)
After segmentation, before any AI call: if the median pill is tiny in the frame (pick a sensible % from tests) say
"Move closer — the pills should fill most of the photo." If ≥ 2 clumps say "Spread them out so none touch." Offer
"Retake" first, "Check anyway" second. Free, no AI.

## Checks
Unit tests for every rule above (consensus allowed / blocked cases, double-read agree/disagree, split/no-split,
coaching). Tests, lint, tsc, build pass. One live run on the user test photo if present (PAID-API LOCK, ≤ $0.30),
report honestly. Screenshots 375 + 1440 of: "Looks right" consensus result, coaching prompt, user-test result.
Handoff to ~/Hackathons/_coord/handoffs/, BOARD in/out, tidy.sh.

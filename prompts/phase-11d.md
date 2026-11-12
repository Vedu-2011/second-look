# Phase 11d — no false reds from a misread letter (small fix on fix/piles)
Builder: Codex or Claude Code. Branch fix/piles (continue). Preview only; merge on "merge". Read BOARD + newest handoff.

## Problem (phase 11c real smoke)
A pile softgel that is really "IB 200" was read "TB 200" at 0.8 → MISMATCH → a false red. Separate softgels also
came back "JB 200", "IB 260", "ID 200". A false red tells someone their correct medicine is wrong — bad for trust.

## Fix: "one letter off" needs a second opinion before it can be red (bottle mode, pile AND separate pills)
- If a pill's verdict is MISMATCH and its read imprint is within ONE character (edit distance 1 after normalizing
  spaces/case/punctuation, per side) of the label medicine's FDA imprint (e.g. TB 200 / JB 200 / IB 260 / ID 200 vs
  IB 200), do one independent second read (same reader; for pile pills use that pill's own crop, 2× upscale, as
  double-read does).
  - Second read gives the SAME near-miss text (agrees) → stays MISMATCH (red). A real look-alike stays caught.
  - Second read gives the label imprint, or disagrees → UNSURE with plain wording: "This might say IB 200, but we
    couldn't read it clearly. Check it with your pharmacist." Never MATCH from this path.
- Imprints clearly different from the label (e.g. "TYLENOL 500", "93", "2263") → red exactly as now, no second read.
- Counts toward the existing max-5-extra-reads budget and quota. Tests with mocked readers (agree / disagree /
  returns label imprint / far-off imprint untouched / budget exhausted → UNSURE, not red... decide and document:
  when the budget is exhausted, a one-letter-off MISMATCH shows as UNSURE "couldn't double-check").
- Also fix: pill 4's second read was "refused on its retry" — make sure a refused/failed second read leaves the pill
  UNSURE with a clear reason, never silently.

## Checks
Tests, lint, tsc, build. Free replay of the phase 11c user-test readings (cached) must now show pill 9 as UNSURE
"might say IB 200", Tylenol still RED, metformin bottle still RED (pill 5 "93"). Paid only if a needed second read
isn't cached (PAID-API LOCK, cap $0.10). Screenshots 375 + 1440. Push preview. Handoff, BOARD, tidy.sh.

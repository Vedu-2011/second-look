# Phase 8 addendum 2 — the softgels actually say "IB 200" (planner-verified from Vedhanth's real photo, Nov 10)

Real photo: test-images/real/bottle/ (or ask Vedhanth). The Kirkland softgels in his bottle are imprinted "IB 200"
(faint print, translucent TEAL/blue-green gel), NOT "IB1". The FDA/RxNav record for the bottle's own NDC 63981-598
lists "IB1" and is COMPLETED — Costco's listing is out of date for the pills in the bottle. Real finding; keep it.

## 1. Replace the demo NDC everywhere (overrides addendum 1 where they differ)
- match label + mismatch label + whole-bottle label: Ibuprofen 200 mg capsule, NDC 69452-212, Mfr Bionpharma
  (RxNav: Bionpharma Inc., imprint "IB200", blue capsule, 20 mm, ACTIVE, rxcui 310964 group).
- different-maker label: unchanged — Advil Liqui-Gels 200 mg capsule, NDC 0573-0169, Haleon.
- Expected: match → MATCH; different-maker → SAME_MEDICINE_DIFFERENT_MAKER ("sold by N companies…" — ~23 FDA
  products list "IB200"); mismatch (Tylenol "TYLENOL;500" caplet) → MISMATCH identified as acetaminophen 500 mg
  (Tylenol); whole bottle (9 IB200 softgels + 1 Tylenol) → bottle RED, the Tylenol pill flagged.
- Update /labels defaults, demo-scenarios, /type prefills, ARCHITECTURE "Decisions", fixtures + tests. Verify all
  with LIVE typed checks first.
- Add the finding to docs/DEVPOST.md under Challenges (planner wording, don't change): "Even our own demo bottle
  surprised us: the FDA listing for the NDC printed on our Kirkland ibuprofen bottle describes a different imprint
  (IB1) than the softgels inside (IB 200). Second Look flags that instead of pretending it matches."

## 2. Color: translucent gels
FDA labels these softgels "blue" or "blue(green)"; phones and the model will often say teal/turquoise/green.
Treat blue ↔ turquoise ↔ green as CLOSE (not different) — FDA's own Advil record says "Transparent green to blue
green". Parse parenthetical FDA color text (e.g. "blue(green)") as both colors. Unit tests. Never let this turn a
mismatch into a match on its own (imprint still decides).

## 3. Faint printed imprints on softgels
The "IB 200" is faint, printed, and on a curved shiny surface. Make sure the pill prompt/crop pipeline doesn't
treat faint print as "blank". If a softgel's imprint can't be read but color + shape match the label's FDA record,
per-pill verdict stays UNSURE (existing rule) — fine. Check with his real photos once present.

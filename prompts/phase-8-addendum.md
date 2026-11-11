# Phase 8 addendum — real demo bottles + one honesty fix (do together with / right after phase 8)

Vedhanth's real pills (verified by the planner against live RxNav, Nov 10):
- Kirkland Signature Ibuprofen 200 mg liquid softgels, NDC 63981-598 (Costco). FDA: blue capsule, 19 mm, imprint
  "IB1", rxcui 310964 (ibuprofen 200 mg oral capsule). Marketing status COMPLETED.
- Tylenol Extra Strength, NDC 50580-937 (Kenvue). FDA: white caplet (oval) with red print, 19 mm, imprint
  "TYLENOL;500", rxcui 209459 (acetaminophen 500 mg oral tablet [Tylenol]). ACTIVE.
- Advil Liqui-Gels 200 mg, NDC 0573-0169 (Haleon): green capsule, 20 mm, imprint "Advil", ACTIVE — label only.

## 1. New demo scenarios (update docs/ARCHITECTURE.md "Decisions", /labels defaults, demo-scenarios, /type prefills)
| Bottle | Label | Pill inside | Expected |
|---|---|---|---|
| match | Ibuprofen 200 mg capsule, NDC 63981-598, Mfr Costco | Kirkland blue "IB1" softgel | MATCH |
| different-maker | Advil Liqui-Gels (ibuprofen) 200 mg capsule, NDC 0573-0169, Mfr Haleon | Kirkland blue "IB1" | SAME_MEDICINE_DIFFERENT_MAKER |
| mismatch | Ibuprofen 200 mg capsule, NDC 63981-598, Mfr Costco | Tylenol caplet "TYLENOL 500" | MISMATCH, identified as acetaminophen 500 mg (Tylenol) |
Verify all three with /type (typed readings) against LIVE data before any photos exist, and add them as tests with
recorded fixtures. Check that the "same drug" group really includes both the generic capsule SCD (310964) and the
Advil capsule SBD (731533) so bottle 2 is SAME_MEDICINE, not MISMATCH.

## 2. Honesty fix: one look, many sellers
"IB1 blue 20 mm" is listed by ~18 labelers (Walgreens, Kroger, Walmart, Costco, Meijer…). Never present ONE labeler as
"the maker" when several FDA products share the matched imprint + color + shape. Show: "Matches N FDA-listed
versions, sold by <3 names> and N−3 others" (expandable list). If the label's own NDC is among them, show that one
first. Same for MISMATCH identification ("This imprint is listed for acetaminophen 500 mg (Tylenol)…").
Unit tests for single vs many labelers.

## 3. Discontinued label product
63981-598 is COMPLETED in RxNav. When the label's exact product matches but is marked no longer marketed, keep MATCH
and show a calm, small note: "The FDA lists this exact package as no longer marketed; the pill matches its record."
Never a scary message, never a different verdict.

## 4. Real photo shot list for these pills (put in test-images/real/*/README.md)
- softgels: the "IB1" is PRINTED (not stamped), small, on a shiny blue capsule — shoot close, angled light, no glare.
- Tylenol: "TYLENOL" on one side, "500" on the other — the flip step should be demonstrated with this pill.

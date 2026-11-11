# Phase 8 addendum 3 — FINAL demo set (supersedes the scenario tables in addenda 1 and 2; keep their fixes)

Keep from addendum 1: "sold by N companies" honesty fix; calm "no longer marketed" note.
Keep from addendum 2: blue ↔ turquoise ↔ green close for translucent gels; parse "blue(green)"; faint softgel print.
Vedhanth's real pills (planner-verified on live RxNav, Nov 10):
- Metformin HCl 1,000 mg tablet, NDC 70010-065, Granules Pharmaceuticals: imprint "G;12", white(white to
  off-white) oval, 19 mm, ACTIVE, rxcui 861004.
- Amoxicillin 500 mg tablet, NDC 0093-2263, Teva: imprint "93;2263" ("93" one side, "2263" other), white(off-white)
  oval, 17 mm, status DROPPED, rxcui 308192. Look-alike of the metformin.
- Kirkland ibuprofen 200 mg softgels: imprint "IB 200" (faint print), teal/blue; FDA "IB200" blue capsule group.
- Tylenol Extra Strength caplet "TYLENOL;500" (optional extra).

## Demo scenarios (update /labels defaults, demo-scenarios, /type prefills, samples, ARCHITECTURE "Decisions", tests)
| id | Label | Pill(s) | Expected |
|---|---|---|---|
| match | Metformin 1,000 mg tablet, NDC 70010-065, Mfr Granules | metformin "G 12" | MATCH |
| different-maker | Advil Liqui-Gels (ibuprofen) 200 mg capsule, NDC 0573-0169, Mfr Haleon | Kirkland "IB 200" softgel | SAME_MEDICINE_DIFFERENT_MAKER (sold by N companies) |
| mismatch | Metformin 1,000 mg tablet, NDC 70010-065 | amoxicillin "93" → flip → "2263" | MISMATCH; after flip identified as amoxicillin 500 mg (Teva) |
| bottle (phase 9) | Metformin 1,000 mg tablet, NDC 70010-065 | 9 × "G 12" + 1 × amoxicillin | bottle RED, the amoxicillin pill flagged |

Notes:
- "93" alone: the engine must NOT name a medicine from "93" (Teva's mark is on hundreds of products) — it should
  still say MISMATCH vs metformin (imprint confidently read and not in any metformin 1,000 mg product) and ask to
  flip. With "93;2263" it identifies amoxicillin 500 mg exactly. Make sure identification still works when the only
  matching FDA record is DROPPED/discontinued (show the calm "no longer listed" note) — do not hide the name.
- Verify every row with LIVE typed checks first; add recorded fixtures + tests.
- The /labels defaults become exactly these labels (made-up pharmacy/patient as before).

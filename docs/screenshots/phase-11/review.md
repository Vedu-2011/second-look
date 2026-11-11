# Phase 11 verification and separate self-review

Implementation frozen in 3414aab74ec5ead77e5f098d942e3e899feede43 before inspecting or running the user photo. No algorithm changes after that test.

## Checks
- 385 network-free tests in 43 files pass; ESLint, TypeScript and optimized Next.js build pass.
- Synthetic translucent gels, rotated narrow-neck pairs, unequal/three-pill clumps, gray noise and capture coaching cover fixed rules. Three existing NIH DEVELOPMENT composites each still detect nine pills, no clumps. These are functional checks, not an accuracy estimate.
- Separate review covered consensus vetoes, carried-history exclusion, literal conflicting partials, complete vs partial agreement, serialized incremental quota, five-extra-read cap across follow-up verification, worker draining, free preparation before label AI, allow-listed storage and existing continuation authorization. No unresolved correctness finding in that pass.
- The review added a free-preparation quota isolation test. Worker draining and partial-agreement safeguards were completed BEFORE the real-photo freeze.
- Single-pill verdict-engine.ts, all matchers, AI prompts and research/ are unchanged from 78bfa98. No benchmark rescore or claim of improved accuracy.

## One real test, observed result
- Original photo SHA256: 1865d8c99b43fd49efabf12b47e58be14dc662b876b74dccfebd5589e3a6562b. Metadata audit found no GPS tag.
- Known Bionpharma NDC 69452-212 label supplied from the phase prompt; label-reader accuracy was NOT tested.
- Free coaching: Spread them out so none touch. Diagnostic runner explicitly continued.
- Four numbered pills, five unchecked touching regions. Three UNSURE, zero confirmed matches, one MISMATCH: TYLENOL 500 identified as Acetaminophen 500 mg. Consensus correctly blocked. No second read: all three unconfirmed confidences were below .5 (.3, .35, .4).
- Four paid responses; token-priced estimate $0.026090 under durable $0.30 cap; no failed reader calls. Test adapter allowed only two pending requests so conservative reservations fit the cap; production still uses at most five readers. No latency benchmark claim.
- Post-freeze deterministic baseline using unchanged 78bfa98 segment.ts: six numbered pills, four unchecked regions. Phase 11 REGRESSES detection on this photo; it does not solve this capture. Parameters were NOT changed in response. Future work needs a separate development set, then a new untouched evaluation set.
- The source photo reports 9 softgels +1 Tylenol; detected objects/regions are not an audited pill count. We do not claim all ten were located or checked.

## Browser evidence
- 375px and 1440px: synthetic Looks right, actual free coaching endpoint, saved real-result replay. No browser runtime errors or horizontal overflow. Continuation test asserts checkAnyway=1 and stops before paid AI.
- Synthetic consensus has ten generated pills, two mocked imprint confirmations, eight appearance-only UNSURE; it is explicitly a synthetic functional example with real FDA records, not a real clinical success.
- User screenshots replay the exact saved live result at the API boundary; no repeated paid reading. Saved share examples contain readings/positions, never photos. Public evidence photos in this repo are user-supplied test fixtures, separate from app upload storage.
- Existing nonfatal Atkinson Mono fallback-font build warning remains.

Composio discovery returned HTTP401; authenticated Git and Vercel CLIs used for publishing. Preview only; no merge authorized for phase11.

# Phase 9–10 fresh safety review

BUILDER: Codex. Fresh staff reviewer, read-only, snapshot 033ea1c vs main.
Verdict: REQUEST CHANGES. No paid calls, files changed or remote writes by reviewer.

1. **P1 — Old MATCH can transfer to a same-looking replacement** (`src/lib/bottle/match-positions.ts:83`, `check-bottle.ts:88`). Geometry/mean color do not establish imprint identity. Reproduced: swap a similar pill while flipping another; only requested pill read, all green. Fix: require current reads before green, or mark reused results unconfirmed in the current photo.
2. **P1 — Removed clump/cutoff can resolve to green** (`match-positions.ts:69`). Only numbered pills must match; circled objects can disappear. Reproduced: four matches plus cutoff, remove cutoff, zero rereads -> MATCH. Fix: retain unresolved obligations; disappearance cannot resolve them.
3. **P1 — Small/thin cutoff foreground silently ignored** (`segment.ts:236`). Reproduced drawn pill centered x=-30 beside four inside pills: four pills, no clumps. Fix: circle or reject ambiguous foreground at edges.
4. **P1 — Low-confidence appearance inherits engine MATCH** (`verdict-engine.ts:111`, `decide-bottle.ts:11`). Reproduced G12 imprint .9, color/shape .1 unknown -> MATCH. Existing engine behavior predates branch. Fix at bottle confirmation boundary, keeping frozen engine behavior unchanged.
5. **P2 — MISMATCH loses asks/next** (`decide-bottle.ts:67`). Confident 93 returns red but no flip-to-identify action; manual follow-up rereads nothing. Fix preserve red and explicit identification ask.
6. **P2 — Reverse replaces first side** (`check-bottle.ts:88`). Reverse reading discards prior side, preventing full-imprint identification. Fix retain conservative evidence from both views; never turn known mismatch green.
7. **P2 — Public share ID also grants continuation** (`src/app/api/check-bottle/route.ts:57`). Share recipients can reuse another check's label/readings; initial quota still applies, so no demonstrated quota bypass. Fix separate private continuation capability from public result ID.
8. **Evidence limitation** (`src/app/research/page.tsx:120`, `lookalike.ts:15`). Frozen results unchanged, but current shared engine/color/prompt differ from that historical release. Lookalike rationale documented; independent real-bottle sensitivity/false-warning rate not established. Disclose both; no rescore/tuning on demo photos.

Parent independently observed finding 5 in the first real handheld follow-up (zero rereads). All findings accepted for fixes/evidence clarification. Final disposition and tests will be recorded separately after implementation.

Review gaps: no full tests/build/browser/deployed authorization, upload/load adversarial testing, independent real-bottle calibration or benchmark rescore. Parent supplies relevant verification separately.

## Final dispositions (Codex)

All seven concrete findings fixed; none dismissed as “not a bug”.

1. **Fixed + tests:** carried rows become UNSURE/history. If requested reads could permit green, all carried crops must be read in the new photo first. `bottle-flow.test.ts` swaps an identical silhouette with a different imprint; it is read and stays red. Route tests verify quota expansion is incremental and denial emits no result.
2. **Fixed + tests:** missing old circled regions persist as `unresolvedRegions`; green blocked across repeated follow-ups. Separated candidates must account for the former region (two for touching, one for cutoff). Uncertain/fresh matching retains obligations until an explicit new check.
3. **Fixed + tests:** all detected edge foreground remains circled, including thin slivers and apparent surface strips. Synthetic cutoff regression passes. Two earlier tests deliberately changed: an edge strip now creates an unchecked region. This increases false warnings rather than silently accepting foreground.
4. **Fixed + test:** bottle-only confirmation requires confident imprint/color/shape, recognizable appearance, visible single pill. Test with .1 appearance confidences/unknown shape stays UNSURE. Shared single-pill engine untouched.
5. **Fixed + tests/live:** red returns flip-to-identify asks. Initial mismatch remains red; wording explains naming is optional, mismatch already stands. Actual new bottle flags pill 5 red.
6. **Fixed + tests/live:** conservatively merge prior and reverse readings; minimum view confidence and conflict logic unchanged. A known mismatch cannot turn green through its reverse view. Actual handheld follow-up reread only pill 5 and identified Amoxicillin 500 mg. Other rows marked history. Two-view identification assumes the requested pill was flipped in place as instructed; positions alone cannot prove physical identity, and never certify carried matches.
7. **Fixed + tests:** separate private random continuation token; only SHA256 stored outside public result. Missing/cross-check token returns 403 before quota/AI; expired ID 404. Public share remains read-only. Failed UI requests retain prior result/token for retry.
8. **Clarified:** /research explicitly describes frozen pill-v2 results as historical, not current-release performance; independent real-bottle sensitivity/false-warning rates unmeasured. No benchmark rerun or new accuracy claim.

341 network-free tests pass (41 files). Lint, TypeScript and optimized build recorded separately in the final handoff. Reader prompts, matcher thresholds, shared engine and research artifacts have zero diff from the phase-10 starting commit eb397b1.

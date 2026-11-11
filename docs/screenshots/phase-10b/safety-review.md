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

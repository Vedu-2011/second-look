# Review — phases 9 + 10 before merge (Codex, READ-ONLY)
Builder: Codex. Branch feat/phase-9-bottle vs main. Do NOT edit code, commit, push or merge. Claude Code may be
working at the same time — read-only means you can review from the home folder; take no locks; add a BOARD row
("review, read-only").
Read the two newest handoffs in ~/Hackathons/_coord/handoffs/ and Codex's phase 9 entry in "DSH Hacks V2/HANDOFF.md".
Review `git diff main...feat/phase-9-bottle` (run `codex review` against main if that's cheaper), focused on:
1. SAFETY: can a bottle ever show green when a pill is unreadable, face-down, odd, clumped, cut off or not detected?
   Can a low-confidence reading ever turn into MATCH? Can "flip and snap again" carry an old MATCH onto a different
   pill (position matching mistakes, swapped pills, a pill added/removed)?
2. Either-side mismatch: one confident side not in any listed version → MISMATCH; naming needs both sides.
3. Look-alike thresholds (lookalike.ts): sensible, not tuned to Vedhanth's demo photos, documented.
4. Quota/abuse: /api/check-bottle follow-up (previousId) can't be used to skip the quota or read someone else's check.
5. Privacy: no photos stored; shared results hold no images.
6. Frozen research numbers untouched (verdict-engine changes must not alter the benchmark claims on /research).
Run tests + build if your usage allows (no paid API calls). Write findings ranked most severe first, each with
file:line, a concrete failure scenario and a suggested fix, as a handoff in ~/Hackathons/_coord/handoffs/
(BUILDER: Codex). Then remove your BOARD row and run `bash ~/Hackathons/_coord/tidy.sh`.

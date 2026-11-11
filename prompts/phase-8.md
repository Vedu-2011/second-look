# Phase 8 — Premium redesign (VISUAL ONLY — logic stays frozen)

Read first (as always): AGENTS.md and everything it lists, then the NEW docs/DESIGN.md (v2, Apple-Health style) —
it replaces v1 completely. Newest HANDOFF.md entry, git status + log. Plan in 3–5 bullets first.
Branch feat/phase-8-redesign. Merge to main only when everything below passes AND Vedhanth says "merge" after
looking at the preview.

## Rules
- Visual/presentation changes ONLY: tokens, typography, layout, components' markup/styles, motion, copy listed in
  DESIGN.md. Do NOT change verdict logic, matching, AI prompts, research data/results or API behavior.
- All 209+ tests stay green. Update snapshot/DOM tests only where markup legitimately changed.
- Lighthouse accessibility stays 100 on /, /check, /type, /samples, /research. AA contrast on every pair (test the
  new verdict tints and the orange button explicitly). prefers-reduced-motion respected.
- No new paid AI calls except at most one live production smoke check at the end ($0.05 cap).

## Tasks
1. Tokens + fonts: implement DESIGN.md v2 (system SF stack + Inter fallback; Atkinson Mono only for imprints/NDC).
2. Global chrome: sticky translucent blurred nav with "Check a pill" button; new small footer.
3. Home: rebuild exactly per DESIGN.md "Layout — home" (hero with CSS iPhone frame showing a REAL rendered
   mismatch result + floating drawn pills; stat band; AI reads/Code decides flow; bento grid with varied tile sizes;
   tested section with the two positive-but-true numbers + link; final CTA).
4. Drawn pill v2: softer 3D, contact shadow, color glow stage; must still be generated from real FDA fields and
   to scale. Keep PillDrawing's API.
5. Verdict + ResultView v2: tinted verdict cards, comparison cards, symbol list, source chips, script card.
6. /check, /type, /samples, /sources, /research (restyle charts), /labels screen view, 404 — same system.
7. One-pager: restyle the screen version to match; regenerate the PDF only if it still fits ONE Letter page —
   otherwise keep the current PDF and say so.
8. Screenshots BEFORE and AFTER at 375 + 1440 for every page (+ the result screen in all 4 verdicts) →
   docs/screenshots/phase-8/{before,after}/. Look at every AFTER screenshot critically against DESIGN.md and fix
   anything that looks cheap, crowded, misaligned or generic before handing off.
9. Push the branch, get a Vercel PREVIEW URL, run the free smoke on it, write the HANDOFF (BUILDER line) with the
   preview URL at the very top. Do NOT merge to main until Vedhanth says "merge".

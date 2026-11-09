# Phase 0 — Skeleton, design system, live deploy (no AI calls yet)

Read first, in this order: ~/Hackathons/CLAUDE.md, ./CLAUDE.md, docs/ARCHITECTURE.md, docs/DESIGN.md.
DESIGN.md is a hard requirement — the UI must look genuinely beautiful from this first phase.
Before coding, list your plan in 3–5 bullets (what you'll change, which files).

## Goal
A live, public, beautiful skeleton of "Second Look" on Vercel with the full design system in place, so every
later phase just fills in real behavior. No Anthropic calls in this phase.

## Tasks
1. Project setup in THIS folder (it already has CLAUDE.md, HANDOFF.md, docs/, prompts/ — keep them all):
   - Scaffold Next.js 16 (App Router, TypeScript, ESLint, Tailwind v4, src/ dir) in a temp folder and move it in,
     so nothing existing is overwritten. Add vitest. Init shadcn/ui, then restyle its tokens to DESIGN.md.
   - git init (if needed), create a PUBLIC GitHub repo Vedu-2011/second-look with gh, push main.
   - .env.example with ANTHROPIC_API_KEY=, KV_REST_API_URL=, KV_REST_API_TOKEN= (no real values committed).
2. Design system (follow docs/DESIGN.md exactly):
   - Fonts: Atkinson Hyperlegible Next (all UI) + Atkinson Hyperlegible Mono (imprints/NDC/strength only), via
     next/font/google if available, otherwise @fontsource-variable packages.
   - CSS variables: --ink, --label, --foil, --amber, --match, --mismatch, --unsure (exact hexes from DESIGN.md),
     wired into Tailwind theme. Type scale with 18px+ body on mobile. Radius hierarchy from DESIGN.md.
   - src/lib/fda/codes.ts: FDA SPL color codes (C48323…C48334) and shape codes (C48335…C48353) → names, plus
     our display hex for each pill color. Verify the code lists against FDA's SPL documentation before using
     them; cite the source URL in a comment.
   - Components (src/components/): Button (pill-shaped; primary = amber, secondary = foil), StepIndicator
     ("Step 1 of 2"), VerdictField (MATCH / SAME_MEDICINE_DIFFERENT_MAKER / MISMATCH / UNSURE — color + icon +
     word + one-line instruction), FeatureTable (Imprint / Color / Shape / Size rows, ✓ / ✕ / ?, failing row
     tinted), CheckingSteps (4 steps, states: waiting / working / done / failed; prefers-reduced-motion safe),
     SourceBadge ("FDA DailyMed · published <date>" link), and the showpiece:
   - PillDrawing (SVG): props { shapeCode, colorCodes[], sizeMm, imprintSides[], highlight?: 'imprint' |
     'color' | 'shape' }. Draws the pill to scale (round, oval, capsule/oblong at minimum; graceful fallback for
     other shapes), real colors (two-tone capsules split in half), imprint text in Atkinson Mono with a subtle
     debossed look, score line if scored. Must look premium at 375px and 1440px.
3. Pages (skeleton, real copy, design-complete):
   - / home: one calm line about the problem with the Flynn 2003 stat + citation link, "Check a bottle" and
     "Try a sample bottle" buttons. Not a marketing hero — it should feel like the product.
   - /check: the 2-step capture UI (label photo → pill photo) with camera + upload, image preview, and the
     CheckingSteps list — UI only, wired to a fake local state machine for now.
   - /samples: three sample cards (match / different maker same medicine / mismatch) with placeholder photos.
   - /sources: FDA DailyMed, NLM RxNorm, NIH Pill Image Recognition dataset — what each is, what we use it for,
     links. Real copy.
   - /style: internal gallery showing every component and all 4 verdict states, with REAL FDA examples drawn by
     PillDrawing: ibuprofen 200 mg Perrigo "I2" orange round 10 mm (NDC 0113-0074) and orange oval 15 mm
     (NDC 0113-0517); Advil brown oval 16 mm imprint "Advil". Pull the exact values live from RxNav once to
     confirm, then hardcode them in a fixture file with the source URL.
   - Footer on every page: "Second Look helps you spot a possible mix-up. It doesn't replace your pharmacist."
4. Deploy:
   - Link to Vercel (production from main), confirm the production URL is public. Turn OFF Vercel deployment
     protection for preview deployments so preview links open without a login (this blocked us last hackathon).
   - Add Upstash Redis via the Vercel Marketplace (env prefix KV_), pull env to .env.local, and add a tiny
     /api/health route that writes+reads a Redis key and returns { ok, redis: true, time }.
5. Tests: vitest for codes.ts lookups, PillDrawing shape/color selection logic (pure helpers), and /api/health
   handler (Redis mocked). Tests, build and lint must all pass.
6. Screenshots: take 375px and 1440px screenshots of /, /check, /samples, /sources, /style in your browser pane.
   Fix anything that isn't beautiful before finishing. Save them to docs/screenshots/phase-0/.
7. Codex review before pushing; fix real findings. Commit + push.

## Done when
- Production URL is live and public; /api/health returns redis: true.
- /style shows all components and three real FDA pills drawn correctly.
- Tests/build/lint pass; screenshots saved; HANDOFF entry added to the TOP of HANDOFF.md
  (include the production URL, repo URL, and anything that needed Vedhanth).

## How to test (run it yourself, list results in the handoff)
1. Open the production URL on a 375px viewport → home looks finished, stat has a working source link.
2. /check → step 1 → choose/upload a photo → preview → step 2 → "Checking…" list animates (fake) → ends.
3. /style → all 4 verdict states readable, PillDrawing renders I2 round, I2 oval, Advil oval to scale.
4. /api/health → { ok: true, redis: true }.
5. Keyboard: Tab through /check — focus is always visible. Reduced motion: no animation, steps still tick.

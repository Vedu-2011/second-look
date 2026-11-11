# DESIGN.md v2 — Second Look: Premium Apple-Health style (replaces v1; v1 kept in DESIGN-v1-archive.md)

Vedhanth's verdict on v1: "looks like it was made in the 1950s." v2 must feel like a 2026 Apple Health / Apple.com
product page: bright, airy, confident, premium, calm. Think apple.com/health, Apple Health app summary cards,
Apple Watch feature pages. Judges should think "this looks like a real product".

## What stays (good bones)
- The drawn FDA pill (SVG from real FDA data) — it becomes the HERO object, bigger and more 3D.
- Verdict semantics: MATCH / SAME_MEDICINE / MISMATCH / UNSURE always = color + icon + word.
- Plain, calm words. Accessibility (Lighthouse 100, AA contrast, focus rings, reduced motion). No hairline borders.

## Type
- UI/body/display: the Apple system stack — `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
  "Inter", system-ui, sans-serif` — so Mac/iPhone judges see SF Pro. Load Inter (next/font) as the fallback for
  everyone else. Drop Atkinson Hyperlegible Next for UI text (its quirky shapes read "old").
- Keep Atkinson Hyperlegible Mono ONLY for imprints / NDC / strength values (O vs 0, I vs 1 still matter).
- Scale (desktop / mobile): hero 88/48px, weight 700, letter-spacing −0.035em, line-height 1.02; section titles
  56/36px −0.03em; card titles 24/20px 600; body 19/17px, line-height 1.5, color #1D1D1F; secondary #6E6E73.
- Sentence case. No underlined orange links in body copy — links are plain text in brand blue/orange with a ›.

## Color (light mode)
- --bg          #FFFFFF   main background
- --bg-soft     #F5F5F7   alternating section background (Apple gray)
- --ink         #1D1D1F   primary text
- --ink-2       #6E6E73   secondary text
- --brand       #FF9500   Second Look orange (bottle) — vivid, used for the logo, primary button, key highlights
- --brand-deep  #C93400   orange text on white when needed (AA)
- --blue        #0071E3   links / secondary actions (Apple link blue)
- Verdicts (tinted cards, NOT solid slabs):
  - match      icon #34C759, title #1F7A3A, card gradient #F2FBF4 → #E3F6E8
  - same       icon #30B0C7 (teal), title #0E6F80, card gradient #EEF9FB → #DDF2F6
  - mismatch   icon #FF3B30, title #C9241A, card gradient #FFF4F3 → #FFE3E0
  - unsure     icon #8E8E93, title #3A3A3C, card gradient #F7F7F8 → #ECECEF
  Verify AA for every text/background pair.

## Surfaces, depth, shape
- Cards: white, radius 28px (24px mobile), shadow `0 1px 2px rgba(0,0,0,.04), 0 12px 32px rgba(0,0,0,.08)`.
  On --bg-soft sections cards float; on white sections use subtle elevation only.
- Buttons: pill-shaped, 52px tall, primary = --brand fill with white bold text ONLY if AA passes at that size
  (else #1D1D1F text, or --brand-deep fill) — test it; secondary = --bg-soft fill, ink text. Gentle press scale 0.98.
- Sticky translucent nav: white at 72% + backdrop blur 20px, logo left, links right, "Check a pill" pill button.
- The drawn pill: larger, softer 3D (inner highlight + soft contact shadow), sits on a white "stage" with a soft
  radial glow in the pill's own color. No gray boxes behind pills.
- Generous whitespace: section padding 140/80px. Max content width 1080px; text columns ≤ 640px.

## Layout — home (center-aligned, Apple product-page rhythm)
1. Hero (white): small orange "Second Look" eyebrow is NOT allowed (no eyebrows) — instead: huge centered headline
   "Is this the right pill?", one line under it ("Snap the label and one pill. Get the answer, with the FDA's proof,
   in about 10 seconds."), two buttons (Check a pill · Try a sample). Below: a large, CSS-built iPhone frame showing
   a REAL rendered result (the mismatch: verdict card + FDA pill vs photo), with 2–3 big drawn FDA pills floating
   around it (soft float animation, off with reduced motion).
2. Stat band (soft gray): one giant number "51.5 million" + "pharmacy dispensing errors a year in the US" +
   tiny source. Second line: "34% / 66%" story in one sentence.
3. "AI reads. Code decides." (white): big statement, then a horizontal 3-step flow (it IS a sequence) with large
   icons: Photograph → Read → Check against every FDA record → Answer. Small line on the guardrail.
4. Bento grid (soft gray), tiles of DIFFERENT sizes (not identical boxes):
   - big tile: "The FDA's picture, next to yours" — drawn pill vs photo comparison.
   - tall tile: "Every maker. Every version." — "507 versions of ibuprofen 200 mg" (live number).
   - tile: "Same medicine, new look" — the teal verdict + Kesselheim line.
   - tile: "Can't tell beats guessing."
   - tile: "Built for older eyes" — big type, Lighthouse 100.
5. Tested section (white): "Tested on 150 photos it had never seen." Two big numbers side by side:
   "83 of 88 right when it answered" and "4 vs 9 false alarms vs asking AI directly" + "Read the research ›".
   (No negative "70.6% can't tell" line on the home page; /research keeps the full honest numbers.)
6. Final CTA (soft gray): "Take a second look." + buttons. Footer: small, gray, disclaimer, links.

## Other pages (same system)
- /check: one focused card at a time, big camera tile with a dashed? NO dashed borders — use a soft tinted drop
  zone; step indicator as two small dots; Checking = Apple-style ring/spinner per step + check marks.
- Result: tinted verdict card on top (icon in a colored circle, big title, one-line instruction), then two large
  white cards side by side (FDA drawing on a glow stage | user photo, rounded), then "Feature by feature" as a clean
  list with ✓ ✕ ? symbols in colored circles, then evidence as small pill-shaped source chips, then the pharmacist
  script in a soft card with a Copy button.
- /samples: three large product-style cards with the drawn pills and verdict chips.
- /type, /sources, /research, /labels, /one-pager (screen version): same tokens. Charts restyled (rounded bars,
  brand colors, no gridline clutter).

## Motion (premium = subtle)
- One page-load reveal on the hero (fade + 12px rise, 600ms ease-out). Floating pills (6s, ±8px).
- Verdict reveal: card scales 0.96 → 1 with spring, icon draws in. Steps tick with a smooth check.
- Everything off under prefers-reduced-motion.

## Don'ts
No hairline borders, no gray boxes behind pills, no underlined body links, no identical card rows, no stock
illustrations, no emoji, no gradients as decoration except the verdict tints and pill glow, no cream backgrounds.

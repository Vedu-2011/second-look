# DESIGN.md — Second Look (read before touching ANY UI)

Vedhanth's bar: the UI has to be genuinely beautiful — the kind judges screenshot. Not a shadcn template.
This brief is the source of truth for every screen. If something here conflicts with a default, this wins.

## The idea behind the look
The world of this app is the pharmacy counter: the amber prescription bottle, the crisp white label, the tiny
letters stamped into a pill, the silver foil of a blister pack. We borrow those materials — not stock "health app"
blue gradients, not hearts and stethoscopes. The app should feel calm, exact and trustworthy, like a careful
pharmacist double-checking for you.

## The one memorable thing: the drawn pill
On every result we DRAW the pill the FDA says should be in the bottle — an SVG built live from the DailyMed
record: its real shape (round / oval / capsule…), its real color(s), its size in mm to scale, and its imprint
letters stamped in with a subtle debossed effect. It sits right next to the user's own photo of the pill.
"What the FDA says it should look like" vs "what's in your bottle". When something doesn't match, that exact
feature (e.g. the imprint) is highlighted on both. Spend the boldness here; keep everything around it quiet.

## Color (CSS variables, light theme only)
- --ink        #17202B  deep slate ink — text, icons
- --label      #FAFBFC  label white — page background (cool white, NOT cream)
- --foil       #E7EAEF  blister-foil silver — surfaces, wells, photo frames
- --amber      #E0901E  prescription-bottle amber — brand mark, camera frame, primary button. Use sparingly.
- --match      #1C8A57  verdict: matches
- --mismatch   #C42F2A  verdict: does not match
- --unsure     #4A5A85  verdict: can't tell — retake / ask pharmacist
Verdict colors are the loudest thing on screen and appear ONLY on verdicts. Every verdict also has an icon and a
word, so it works for color-blind users. Check contrast ≥ 4.5:1 for all text.

## Type
- Atkinson Hyperlegible Next (Google Fonts) for everything. It was designed by the Braille Institute for people
  with low vision — exactly our users (older adults, caregivers). Mention this in the Devpost.
- Atkinson Hyperlegible Mono ONLY for things matched character by character: imprints ("I-2", "L484"), NDC codes,
  strengths. Showing these in mono is the point — O vs 0, I vs 1.
- Big, generous sizes: body 18px min on mobile, 20px on desktop. Verdict word 56–72px, bold.
- Sentence case everywhere. No all-caps labels, no tracked-out eyebrows above headings.

## Layout
Mobile first (375px), single column, left aligned. Desktop (judges on laptops, projector 1920px): centered column
max ~720px for the flow, the comparison goes side by side.

Capture flow (a real sequence, so a 2-step indicator is OK):
  [ Step 1 of 2: Photo of the label ]   amber camera frame, "Use camera" / "Upload a photo"
  [ Step 2 of 2: Photo of one pill   ]   tip: "Put one pill on a plain surface, imprint side up, good light"

Checking (the ONE orchestrated motion moment, ~4–6 s, real progress not fake timers):
  Reading your label…  →  Reading the pill…  →  Looking up FDA records…  →  Comparing 4 features…
  Each line ticks as the real step finishes. Respect prefers-reduced-motion (no animation, just ticks).

Result:
  ┌───────────────────────────────────────┐
  │  ✕  Doesn't match                     │  full-width verdict field in --mismatch, white text
  │  Don't take this. Call your pharmacy. │
  └───────────────────────────────────────┘
   Your label says              In your bottle
   Ibuprofen 200 mg             [user photo]
   [DRAWN PILL from FDA]        
   Feature table: Imprint · Color · Shape · Size — each row ✓ / ✕, the failing row tinted
   "This imprint belongs to: Acetaminophen 500 mg" (from FDA)
   What to say when you call  →  short script, Copy button
   Source: FDA DailyMed label, published <date> (link) · RxNorm

Home / landing (what a judge sees first): not a marketing hero — the product itself. One line about the
problem with the real stat, then "Check a bottle" and "Try a sample bottle" (judges don't have pills — the samples
are our real demo photos, one match, one mismatch, one "different maker, same medicine").

## Surfaces and shape
- No thin gray hairline borders anywhere (Vedhanth hates them). Separate with spacing, --foil wells and soft,
  low shadows.
- Radius has a hierarchy: photos and the verdict field 20px, buttons fully rounded (pill-shaped — on theme),
  table rows 12px. Not one radius on everything.
- No gradient washes, no glassmorphism, no stock illustrations, no emoji in the UI.

## Words
Plain and calm, written for a worried 70-year-old or their adult kid. Buttons say exactly what happens:
"Take label photo", "Check my pill", "Copy what to say". Errors say what went wrong and how to fix it
("We couldn't read the imprint. Try again with the pill closer and better light.").
Never sound like an AI. Never give medical advice beyond "don't take it, call your pharmacist".

## Quality floor (non-negotiable)
Responsive 375 → 1920. Visible keyboard focus. Tap targets ≥ 48px. Reduced motion respected. Works one-handed.
Loads fast on phone data. Take screenshots at 375px and 1440px after every UI change and fix anything ugly
before handing off.

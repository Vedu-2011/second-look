# Devpost submission — Second Look (DSH Hacks V2)

Paste each section into the matching Devpost field. Numbers are from the app/research — don't change them.
[BRACKETS] = fill in after the real demo bottles are photographed.

## Project name
Second Look

## Tagline (Devpost "elevator pitch", ≤200 chars)
Snap the pharmacy label and one pill. Second Look checks the pill against every FDA record for that medicine and shows you the proof in about 10 seconds.

## Inspiration
Most people never check the pills in their bottle against the label. Pharmacies are careful, but at the scale of
billions of prescriptions, mistakes still happen: Flynn et al. estimated about 51.5 million dispensing errors a year
in US community pharmacies. And there's a second problem. When a refill suddenly looks different, people get worried
and some stop taking it. Kesselheim et al. found 34% higher odds of stopping heart medicine after a pill's color
changed, and 66% after its shape changed. Often it's the same medicine from a different company, but there's no easy
way to know.

So we asked a simple question: can a phone tell you, in seconds, whether the pill in your hand is the medicine on
your label, and prove it?

## What it does
- Take a photo of the pharmacy label and one pill (or type what's on the pill if you don't have a camera).
- Second Look reads the label and the letters stamped on the pill, then checks the pill against every FDA record
  for that medicine and strength, from every manufacturer.
- You get one of four answers:
  - **Matches**: this is the medicine on your label.
  - **Same medicine, different maker**: it looks different because another company made it. Same medicine, same
    strength.
  - **Doesn't match**: don't take it, call your pharmacy. If the FDA lists that imprint for another medicine, we
    tell you which one.
  - **Can't tell**: the photo or the records aren't clear enough, so we say so instead of guessing.
- Every result shows the evidence: a drawing of what the FDA says the pill should look like (real shape, color,
  size and imprint) next to your photo, a feature-by-feature comparison, and links to the exact FDA DailyMed record.
- For a mismatch, it gives you a short script for what to say when you call your pharmacy.
- Try it without pills: the sample bottles run the real check live.

## How we built it
**AI reads. Code decides.** That's the core idea.
- **Reading:** Claude Sonnet 5.5 (vision) reads the label and the pill: imprint on each side, color, shape. It only
  transcribes what it sees, with a confidence for each field. Claude Haiku 5.5 writes the plain-English explanation
  and pharmacist script.
- **Deciding:** plain TypeScript code, not the AI, makes every decision. It looks up the label's product in NLM
  RxNorm, pulls every product of the same medicine and strength (507 versions of ibuprofen 200 mg, for example),
  compares imprint, color and shape, and picks the verdict. It handles real-world mess: imprint sides in any order,
  "I-2" vs "I2", look-alike characters, caplets the FDA calls "capsule".
- **Guardrail:** if the AI's explanation mentions any drug, strength, imprint or number the code didn't produce, we
  throw it out and use a safe template.
- **Real data:** FDA DailyMed (labels and publication dates), NLM RxNorm/RxNav (products, imprints, colors, shapes,
  sizes from every maker), and the NIH/NLM Pill Image Recognition dataset for testing. Demo patient labels are made
  up; the pills and records are real.
- **Stack:** Next.js 16, TypeScript, Tailwind, Anthropic API, Upstash Redis (caching), Vercel, Vitest (209 tests),
  Recharts. Accessibility: Lighthouse 100 on every main page, and pill imprints are shown in Atkinson Hyperlegible Mono,
  designed by the Braille Institute for people with low vision, so O vs 0 and I vs 1 are easy to tell apart.
- **How the code was written:** I designed the product and the architecture and directed the build; AI coding tools
  (Claude Code and Codex) wrote the code under rules I set (tests, reviews, design system), with every change checked.

## Research: tested on photos it had never seen
We tested Second Look on 150 real NIH phone photos (75 products, 300 label–photo pairs) that we never tuned on, and
compared it with simply asking the AI "is this the right pill?"

| | Second Look | Asking the AI directly |
|---|---|---|
| Right when it gave an answer | 83 of 88 | 83 of 94 |
| False alarms on the right pill | 4 | 9 |
| Wrong pills called fine | 1 | 2 |
| Said "can't tell" | 212 of 300 | 206 of 300 |

These 2016 photos show one side of a single pill, so both methods often couldn't tell. The test also found a real
safety bug: a one-character look-alike imprint could slip through. We fixed it and published the before and after.
Full method, every pair and every result: https://getsecondlook.vercel.app/research

## Challenges we ran into
- Pill photos are hard: tiny stamped letters, glare, and the imprint is often on the other side. We added a
  "flip the pill" step and a "can't tell" answer instead of forcing a guess.
- FDA data is messy: the same medicine comes in hundreds of versions, two-tone colors are packed into one field,
  descriptor words hide inside imprints, and many products are discontinued. Fun fact from the data: the most
  common look for ibuprofen 200 mg isn't the orange oval most people picture; it's a brown round "I2".
- Being honest about results. Our goal was to cut the "can't tell" rate a lot, and on the fresh test we didn't.
  We published that anyway, along with the bug the test found.

## Accomplishments that we're proud of
- An answer you can check: every verdict links to the FDA record it used.
- A fresh, never-tuned-on benchmark with every pair published, where the test caught a real safety bug that we
  then fixed in the open.
- Accessibility scores of 100 and a design built for older adults: big type, plain words, high contrast.

## What we learned
- Letting AI read but not decide makes a health tool much easier to trust and to test.
- "Can't tell" is a feature, not a failure. A safety tool should say when it doesn't know.
- How to run a fair test: freeze the code first, test once on data you've never seen, and report the misses.

## What's next for Second Look
- Testing with real, current phone photos from patients and caregivers (with a pharmacist), not 2016 archive images.
- Reading both sides of the pill automatically from a short video.
- Spanish and other languages for the results and pharmacist script.
- A pharmacy-counter version: a quick last check before the bag is handed over.

## Built with
nextjs, typescript, react, tailwindcss, anthropic-claude, claude-vision, fda-dailymed-api, nlm-rxnorm-rxnav,
nih-pill-image-dataset, upstash-redis, vercel, vitest, recharts, zod, sharp

## Links
- Live app: https://getsecondlook.vercel.app
- GitHub: https://github.com/Vedu-2011/second-look
- Research: https://getsecondlook.vercel.app/research
- One-page PDF: https://getsecondlook.vercel.app/second-look-one-pager.pdf
- Demo video: [YouTube link, unlisted]

## Safety note (put at the bottom of the description)
Second Look helps you spot a possible mix-up. It doesn't replace your pharmacist. If it says Doesn't match or Can't
tell, don't take the pill until you've talked to your pharmacist. Voiceover in the demo video: elevenlabs.io.

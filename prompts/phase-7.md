# Phase 7 (content fix, allowed under feature freeze) — One-pager rewrite + real sample photos if present

Read first (as always): AGENTS.md and everything it lists, newest HANDOFF.md entry, git status + log. Plan in 3 bullets.

## 1. Rewrite /one-pager with EXACTLY this copy (the planner wrote it; don't add hedging or change numbers)
Keep the design system, one US Letter page, QR code, citations. Use the full page (no big blank bottom).

Title: Second Look
Subtitle: Is the pill in your bottle the medicine on your label?
Intro: Take a photo of the pharmacy label and one pill. Second Look reads both, checks the pill against every FDA
record for that medicine, and shows you the proof in about 10 seconds.

Box — Why it matters
- US pharmacies make an estimated 51.5 million dispensing errors a year.[1]
- When a refill suddenly looks different, people are more likely to stop taking it: 34% higher odds after a color
  change, 66% after a shape change.[2]
- Second Look is for the people who catch these mix-ups at the kitchen table: older adults and the family members
  who manage their medicines.

Section — AI reads. Code decides.  (keep the 5-step diagram: Label photo → Pill photo → AI reads → FDA records → Code decides)
Claude reads the label and the letters stamped on the pill. Then plain code, not the AI, compares the imprint, color
and shape with every maker's FDA record for that medicine and picks the answer: Matches, Same medicine from another
maker, Doesn't match, or Can't tell. Every answer links to the FDA record it used.

Visual (replace the two cropped images with ONE clean, uncropped screenshot): the real MISMATCH result showing the
red verdict AND the side-by-side "What the FDA says it should look like" vs "What's in your bottle" cards (drawn I2 vs
L484), cropped to look intentional. Caption: The wrong pill, caught: the FDA's picture of what should be in the
bottle, next to what is.

Line — Real records: FDA DailyMed · NLM RxNorm (507 versions of ibuprofen 200 mg, from every maker) · NIH Pill Image
dataset. Demo patient labels are made up; the pills and the records are real.
(Use the live product count from the app if it differs from 507; never invent it.)

Box — Tested on photos it had never seen
We tested Second Look on 150 real NIH phone photos (75 products, 300 label–photo pairs) that we never tuned on, and
compared it with simply asking the AI "is this the right pill?"
Small 3-column table (no hairline borders):
| | Second Look | Asking the AI directly |
| Right when it gave an answer | 83 of 88 | 83 of 94 |
| False alarms on the right pill | 4 | 9 |
| Wrong pills called fine | 1 | 2 |
| Said "can't tell" | 212 of 300 | 206 of 300 |
These 2016 photos show one side of a single pill, so both methods often couldn't tell. The test also found a real
safety bug: a one-character look-alike imprint could slip through. We fixed it and published the before and after.
Full method and every result: getsecondlook.vercel.app/research

Footer: Second Look helps you spot a possible mix-up. It doesn't replace your pharmacist. If it says Doesn't match
or Can't tell, don't take the pill until you've talked to your pharmacist.
Links: getsecondlook.vercel.app · github.com/Vedu-2011/second-look · QR "Try the app"
Citations: keep [1] Flynn 2003 and [2] Kesselheim 2014 with PMIDs, plus the dataset citation.

Re-export public/second-look-one-pager.pdf + docs copy (exactly 1 Letter page, check render), screenshot it.

## 2. Real sample photos
If test-images/real/{match,different-maker,mismatch} now contain label.jpg + pill.jpg (and optional pill-back.jpg),
run `npm run samples:build`, review the printed verdicts, commit, deploy, and report them. If empty, skip and say so.

## 3. Checks + handoff
Tests/lint/tsc/build green, push to main, verify production PDF bytes match, HANDOFF at the top (BUILDER line).

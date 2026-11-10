# Phase 3 — Real demo bottles, live sample checks, "type it in", polish

Read first (as always): AGENTS.md and everything it lists — ~/Hackathons/CLAUDE.md, ./CLAUDE.md, docs/ (incl.
every "Decisions after…" section), the newest HANDOFF.md entry, git status + log. Plan in 3–5 bullets first.

## Starting state
Phase 2 is merged to main (Vedhanth said "merge"). If it isn't, stop and ask him. First commit the planner files
that are sitting uncommitted (AGENTS.md, docs/ARCHITECTURE.md, prompts/phase-2.md, prompts/phase-3.md) in their
own commit "Planner docs".

## Goal
Judges can watch the REAL AI check a REAL bottle with one tap, without owning pills; Vedhanth can print the demo
labels; anyone without a camera can type what's on their pill. Everything looks finished.

## Tasks
1. Printable demo labels — /labels (noindex, not in nav):
   - Three realistic, made-up pharmacy labels (keep "Maple Street Pharmacy" and patient "Alex Rivera"), one per
     scenario, each with: Rx #, patient, drug + strength + form, directions, qty, NDC, "Mfr:" line, fill date,
     pharmacist initials. Print CSS: each label exactly 3.5 in × 2 in, crisp black text, 3 per US Letter page.
   - Every field editable via query params (?drug=&strength=&ndc=&mfr=…), so when Vedhanth buys the real pills
     we just change the NDC/maker to match the actual bottles. Defaults: MATCH = Ibuprofen 200 mg tablet,
     NDC 0113-0517 (L. Perrigo); DIFFERENT MAKER = Advil (ibuprofen) 200 mg, NDC 0573-0160 (Haleon);
     WRONG PILL = Ibuprofen 200 mg tablet, NDC 0113-0517.
   - Small footer on each label: "Sample label for a demo — not a real prescription".
2. Real-photo samples pipeline:
   - Folder test-images/real/{match,different-maker,mismatch}/ — Vedhanth will drop `label.jpg` and `pill.jpg`
     in each (taken on his phone). Create the folders with a README saying exactly what photo goes where.
   - `npm run samples:build`: for each folder with both photos → resize/strip EXIF → copy to public/samples/<id>/
     → run the LIVE check (same code as /api/check) → save the full result JSON to src/lib/sample-results/<id>.json
     with the date. Prints verdicts. If a folder is empty, keep today's recorded-FDA sample for it.
   - /samples and /samples/[id]: show the real photos (label + pill) when present, and the saved real result.
3. "Run this check live" on every sample: one big button that sends that sample's stored photos through the real
   /api/check, so judges WATCH the steps tick and the real verdict appear (counts against the rate limit like any
   check). If the AI is down/over cap, fall back to the saved result with a calm note.
4. "No camera? Type what's on your pill" — public /type (replaces /dev/check; keep /dev/check redirecting to it):
   polished to DESIGN.md, plain words, big inputs, color + shape as tappable chips (FDA vocabulary), imprint field
   in Atkinson Mono with a hint ("letters and numbers stamped on the pill"), label by NDC OR drug + strength.
   Linked from /check and the home page (quietly). Same ResultView.
5. Polish pass (screenshot 375 + 1440 before and after, fix everything):
   - VerdictField headline must never crowd the edge at 375 (e.g. "Same medicine" wraps cleanly; scale type).
   - Home: make the hero card the live "Try a sample bottle" entry point; keep the cited stats.
   - /sources: add the real counts we use (e.g. "Ibuprofen 200 mg: 507 products from every maker") pulled live,
     with "last checked" time. Add the NIH dataset line with the correct URL from ARCHITECTURE.md.
   - Footer: link to the public GitHub repo.
   - Make sure nothing anywhere says "preview", "coming soon" or "dev".
6. README.md (judges will open the repo): what it is (2 lines + screenshot), why it matters (Flynn + Kesselheim with
   links), how it works (AI reads, code decides — tiny diagram), real data sources, tests count, how to run,
   safety limits. Plain, human words.
7. Tests for the label params, samples pipeline (mocked), /type. Keep all existing tests green. Codex/self review,
   fix real findings. Push to main (auto-deploys). Screenshots → docs/screenshots/phase-3/.
8. HANDOFF entry at the TOP of HANDOFF.md (BUILDER line!). List exactly which sample folders had real photos.

## How to test
1. /labels prints 3 labels on one page (Cmd+P preview), text sharp, NDCs right; ?ndc= changes it.
2. With photos in test-images/real/mismatch: `npm run samples:build` → MISMATCH saved; /samples/mismatch shows the
   photos; "Run this check live" streams steps and gives the same verdict on production.
3. /type: NDC 0113-0517 + "I2" orange oval → Matches; "L484" white → Doesn't match + names acetaminophen.
4. 375px: no verdict headline touches the edge; no "preview/coming soon" text anywhere (grep the built output).

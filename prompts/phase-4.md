# Phase 4 — The research test: a real benchmark on NIH pill photos + /research page

Read first (as always): AGENTS.md and everything it lists, the newest HANDOFF.md entry, git status + log.
Plan in 3–5 bullets first. Work on a branch; push to main when tests/build pass and the numbers are verified.

## Why
DSH has a "Best Research-Oriented Project" prize, and judges trust numbers they can check. We want one honest,
reproducible headline like: "On N real NIH phone photos, Second Look caught X% of wrong pills with Y% false alarms."
Every number on the site must come from this run, with N stated. Never round up, never cherry-pick.

## Data
- NIH/NLM Pill Image Recognition dataset: https://data.lhncbc.nlm.nih.gov/public/Pills/index.html (paper: Yaniv et al.
  2016, PMID 29854569). Explore its index files (image → NDC / part / layout). Use CONSUMER photos (phone-quality),
  not only studio references. Download ONLY a subset you need into research/data/ (gitignored); never commit the
  whole dataset. Record exact source URLs and file names in research/DATA.md.
- Ground truth for each image = its NDC → our own RxNav client (ndcstatus=ALL) → FDA imprint/color/shape.
  Skip images whose NDC has no FDA imprint; count and report how many were skipped and why.
- Fixed random seed; sample ~200 consumer images across as many different products as possible (≥ 80 NDCs).

## Experiments (script: `npm run research` → research/out/)
Read each image ONCE per model with the exact production readPill (cache readings to research/out/readings-<model>.json
so re-runs cost nothing). Models: claude-sonnet-5-5 and claude-haiku-5-5. Hard budget: stop if estimated spend
> $8 total (print running cost).
A. Reading accuracy (per model): imprint exact / close / wrong / no-read; color agreement; shape agreement.
B. Verification — our real task (per model): build pairs (label NDC, photo). 50% "right pill" = the photo's own NDC.
   50% "wrong pill" = a different NDC, of which at least half are HARD look-alikes (same FDA color AND shape,
   different imprint). Run the production verdict engine with label = that NDC. Report:
   - catch rate = wrong pills marked MISMATCH (and how many UNSURE),
   - false alarm rate = right pills marked MISMATCH,
   - right-pill pass rate = right pills marked MATCH / SAME_MEDICINE; UNSURE rate overall,
   - all of it split by easy vs hard look-alikes.
C. Why "AI reads, code decides" matters (baseline): for the same pairs, ask Sonnet directly in one prompt
   "Here is a photo; the label says <drug strength, NDC>. Is this the right pill? Answer MATCH / MISMATCH / UNSURE."
   Compare its catch rate and false alarms with our pipeline. Report honestly whichever wins.
D. Ablation: our pipeline with look-alike folding (0/O, 1/I/L…) turned off.
Also report time and cost per check.

## Outputs
- research/out/results.json (all metrics + N + model IDs + prompt version + date + seed) and research/out/pairs.csv
  (every pair: image file, label NDC, truth, reading, verdict) so anyone can audit it.
- research/REPORT.md: plain-English method, results tables, limitations (dataset is from 2016; some products
  discontinued; consumer photos are of single pills on plain backgrounds; our readings use one photo, no size), and
  how to reproduce. Cite the dataset paper.
- /research page (linked from footer and /sources), built to DESIGN.md: one headline sentence with the real
  numbers, 2–3 clear charts (recharts): catch rate vs false alarms (ours vs direct-AI baseline, both models), easy vs
  hard look-alikes, imprint reading accuracy. "How we tested" in plain words, link to REPORT.md + pairs.csv on GitHub,
  limitations box. Mobile-first, no hairline borders, beautiful.
- Add the headline number (with N) to the README and as one quiet line on the home page linking to /research.

## Tests
Unit tests for pair building (balance, hard-negative rule, seed reproducibility), metric math, and the results
loader. Keep all existing tests green. Self-review / Codex review, fix real findings. Screenshots of /research at
375 + 1440 → docs/screenshots/phase-4/.

## Handoff
At the TOP of HANDOFF.md (BUILDER line). Paste the final metrics table, N, skipped counts, total spend, and anything
surprising — good or bad. If Sonnet's catch rate or false-alarm rate looks bad, say so plainly and suggest fixes.

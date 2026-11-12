# Phase 11f — bug: "Move closer" shows when the pills already fill the photo
Builder: Claude Code or Codex. New branch fix/move-closer from main. Read BOARD + newest handoff.
Screenshot: docs/screenshots/phase-11f/vedhanth-move-closer-bug.png (production, Nov 12 5:42 AM). ~14 teal softgels
+ 1 Tylenol in a loose pile, filling most of the frame, phone close — yet coaching said "Move closer". He can't get
closer. This blocks the main flow.

## BUG 0 (more urgent): "Check anyway" → "Something went wrong looking up FDA records. Please try again." on ~15 pills
Same photo, production 18231c8, ~5:44 AM Nov 12. Planner checked: /api/health ok, RxNav + DailyMed reachable,
typed /api/verify with the Advil label works. That message is friendlyFdaMessage()'s catch-all for a NON-FdaError,
so something in the bottle path is throwing per pill — likely new code (phase 11c/11d/11e/(a): pile reader, one-pill
region reads, near-miss double read, outlines) or a burst of parallel RxNav calls getting rate-limited/timeouts.
- Read the production function logs for /api/check-bottle around 13:40–13:46 UTC (`vercel logs` / Vercel dashboard)
  and find the real exception. Fix the root cause with a regression test.
- Never show a code bug as an FDA error: log the real error server-side, and show "Something went wrong on our side
  checking this pill" for non-FDA errors. FDA lookups for the SAME label must be done once per bottle and shared
  (cache by NDC/rxcui), with a concurrency limit and retry with backoff on 429/5xx.
- Reproduce free if possible with a synthetic pile scene + mocked readers; if it only reproduces live, one paid run
  under PAID-API LOCK (cap $0.10) with test-images/real/extra/user-test-ibuprofen-tylenol.jpg.

## "Move closer" — likely cause (confirm)
captureCoaching uses the MEDIAN length of detected separate pills. In a pile most pills are inside touching regions,
so the "separate pills" left are few — or tiny specks / wood-grain bits — and the median is tiny.

## Fix
- "Move closer" only when the pills really are small: use ALL pill-like foreground (separate pills + touching regions,
  ignoring specks under ~0.3 of a typical pill / under a minimum pixel size), and trigger only if the largest few
  objects are small AND the total pill foreground is a small part of the photo. Pick numbers from synthetic far /
  close / pile scenes, not from this photo. Document them.
- Never show "Move closer" when touching regions or pills span a large part of the frame.
- Tests: far-away spread pills → coach; close pile (synthetic, like the screenshot) → no coach; mix with specks → no
  false coach. Free check: run the segmenter + coaching on every real photo in test-images/real/ (none should say
  "Move closer"; the metformin bottle, user-test pour, piles). No paid calls.
Tests, lint, tsc, build, codex review. Then Vedhanth says merge: MAIN LOCK, merge to main, check production /check,
release lock. Also commit docs/SCRIPT.md (planner's edits) in its own commit "Update video script v2".
Handoff, BOARD, tidy.sh.

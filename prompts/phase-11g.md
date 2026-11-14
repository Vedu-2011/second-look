# Phase 11g — URGENT bug: pills photo "failed, retry" twice (DSH due Sat Nov 14, 11:45 PM)
Builder: whoever is free (Claude Code or Codex). New branch fix/retry from main. Read BOARD + newest handoff.

## What happened (production, Fri Nov 13 ~10:30–10:36 PM PT = Nov 14 06:30–06:36 UTC)
Vedhanth: Advil label photo → pills photo (≈16 teal softgels + 1 Tylenol, loose piles on wood). After the pills
photo the app said it failed / "retry" and sent him back to the pills camera — TWICE. Each time he just pressed the
next/continue button again with the same flow, and the 3rd attempt worked: final result is correct (Tylenol red ring
"14 ×", docs/screenshots/phase-11g/vedhanth-result-after-retries.png).

## Do first — logs expire fast (Vercel Hobby keeps runtime logs ~1 hour)
Right away: `vercel logs` / dashboard for /api/check-bottle around 06:25–06:40 UTC Nov 14. Phase 11f added
server-side error logging (name/message/stack), so the real error should be there. Save the relevant lines
(no photos, no readings) to docs/screenshots/phase-11g/logs.txt. Likely suspects: function timeout (many pile/
single reads + second reads on a 17-pill photo → exceeds maxDuration), Anthropic 429/overload, upload size,
or the client's NDJSON stream dropping.

## Fix
1. Root cause from the logs, with a regression test.
2. Never throw the user back to the camera for a server-side/transient failure. Keep both photos, show
   "That took too long on our side — trying again…" and retry ONCE automatically (same photos, idempotent; no
   double-charging the quota for the same photos: reuse cached reads by image hash). If it fails again: a clear
   message + "Try again" button that resends the SAME photos. "Retake" only when the photo itself is the problem
   (segmentation/coaching).
3. If it's a timeout: raise maxDuration within the Vercel plan limit, and/or stream partial results; make sure
   per-pill reads run with bounded concurrency so a 17-pill photo finishes well inside the limit. Measure: time a
   free replay of a 17-pill scene with mocked reader latency.
Tests, lint, tsc, build, codex review (or self-review if Codex is out). Vedhanth says merge: MAIN LOCK, merge,
check production /check, release. Handoff, BOARD, tidy.sh. No paid calls unless needed to confirm (cap $0.10).

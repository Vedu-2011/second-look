# Video v2 — final cut with Vedhanth's own voice + the real shot 3 (DSH due TONIGHT 11:45 PM PT)
Builder: Codex (it built v1 — reuse your lane/pipeline). Read your v1 handoff + docs/SCRIPT.md first. BOARD row in/out.

## New inputs (video/raw/, git-ignored)
- voiceover-vedhanth.m4a (2:38) — Vedhanth's own voice. Use THIS; drop the `say` voice completely. No ElevenLabs credit.
  He changed every "we" to "I" ("I tested the first version…", "I fixed it…") and may have small wording changes.
- shot3-bottle-check.mov (1:12) — the real take: label photo → pills → "Pill 5 doesn't match your label" (red ring)
  → Flip and snap again → "Its imprint is listed for Amoxicillin 500 mg". Replace the placeholder with this.

## Do
1. Captions must match what he ACTUALLY says: transcribe the m4a (whisper / whisper.cpp via Homebrew if available;
   otherwise align the SCRIPT.md text by ear with we→I) and fix timing per line. Burned in, large, high contrast.
2. Cut every visual to his voice timing (his audio is the master track; don't speed it up or chop words). Light audio
   cleanup only: normalize loudness (~-16 LUFS), gentle noise reduction, no music (or very quiet under the intro/outro).
3. Shot 3: speed up waits (2–4×), keep the red-ring moment, the "Pill 5 doesn't match" card, the flip, and the
   "Amoxicillin 500 mg" card at real speed and readable (zoom). Crop the phone status bar. Pill number stays 5 — good.
4. Keep shots 1 and 2 and the laptop captures/cards from v1 where they fit the timeline.
5. Output video/out/second-look-demo-v2.mp4 (1920×1080, H.264/AAC, ≤ 2:59) + contact sheet. Watch it end to end:
   sync, no "trying again" screens, no faces/school names/real labels, every claim matches the claim check.
Handoff with path + duration. Don't upload anywhere.

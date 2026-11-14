# Video — build the DSH demo video (2:30–2:45, hard max 3:00). DUE TONIGHT: DSH closes Sat Nov 14, 11:45 PM PT.
Builder: Codex (Claude Code may be merging on main at the same time — work in your own lane:
`bash ~/Hackathons/_coord/new-lane.sh "DSH Hacks" codex video/demo`; never touch main). Add your BOARD row.
Read docs/SCRIPT.md (v2) — it has the timeline, voiceover text, shot list and claim check. Follow it.

## Inputs (in ~/Hackathons/DSH Hacks/video/raw/ — git-ignored, NEVER commit raw video)
- shot1-pour-take1.mov / take2.mov — hands pour 10 pills from the labelled bottle (pick the better take, ~6–8 s)
- shot2-single-pill-advil.mp4 — phone screen recording: single-pill check, Advil label + Kirkland softgel →
  "Same medicine, different maker"
- shot3-bottle-check-*.mp4 — phone screen recording of the metformin bottle check → red ring → flip → Amoxicillin.
  The good take arrives later today as shot3-bottle-check.mp4. Until it exists, cut with
  shot3-bottle-check-take1-messedup.mp4 as a placeholder and make swapping it a one-line change.

## Build
1. Laptop captures you record yourself (Playwright, 1920×1080, production https://getsecondlook.vercel.app): home,
   /sources, /research (results table + safety-bug note). A simple "AI reads, code decides" diagram card
   (label + pills → Claude reads → FDA/NLM records → code decides) rendered as a 1920×1080 still, in the app's design.
   Stats cards for 0:10–0:24 (51.5 million…; 34% / 66%…) with small citations. End card: logo, URL, a QR code for
   getsecondlook.vercel.app, "Not medical advice. Always check with your pharmacist."
2. Voiceover: the Voiceover column of docs/SCRIPT.md, verbatim. Use macOS `say` with the best installed English voice
   (prefer a Premium/Enhanced voice like Ava or Zoe if present; else Samantha), slightly slower than default.
   Save video/out/voiceover.aiff. No ElevenLabs credit line then. (If Vedhanth drops voiceover.mp3 into video/raw,
   use that instead and add "Voiceover: elevenlabs.io" to the end card.)
3. Edit with ffmpeg (install with Homebrew if missing): 1920×1080, 30 fps, H.264 + AAC, -preset veryfast.
   Phone recordings: center them on a soft neutral background (no black bars), speed up waiting parts (2–4×), cut any
   "trying again" screens, and zoom/crop gently onto the red ring and the "Amoxicillin" line so they're readable.
   Burned-in captions (the voiceover text, short lines, large, high contrast). No music (or very quiet).
   Hide anything personal: no faces, no school names, no real prescription labels, no notifications in the status bar
   (crop the phone status bar).
4. Output video/out/second-look-demo.mp4 + a 6-frame contact sheet PNG. Check: duration ≤ 2:59, audio/caption sync,
   every claim on screen matches the claim check in SCRIPT.md.
5. Do NOT upload anywhere. Vedhanth uploads it to YouTube (unlisted).
Handoff to ~/Hackathons/_coord/handoffs/ with the output path, duration, and what still needs the real shot 3.
BOARD row out, tidy.sh.

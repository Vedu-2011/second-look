# Demo video edit — v2 final cut

This branch contains the reproducible local editor, not the raw media or encoded video. No application code changes.

Current output: **`video/out/second-look-demo-v2.mp4`**, 2:38, 1920×1080, 30fps H.264/AAC. Uses Vedhanth's continuous original `voiceover-vedhanth.m4a` at its original speed, and the real `shot3-bottle-check.mov` with stable pill 5, hand flip and amoxicillin result. No synthetic voice, music, ElevenLabs credit or placeholder flip card. No media uploads.

## Rebuild v2 locally

The approved v1 assets/captures remain in ignored `video/work/`. Keep them; no need to make more API calls. Use FFmpeg-full, Python3, Node/Playwright and the existing isolated QR dependencies described below.

1. Transcribe the actual recording locally with whisper.cpp (small.en full-token JSON timestamps). Cross-check a medium.en pass and difficult excerpts; keep actual wording rather than imposing SCRIPT.md. Outputs live in `video/work/v2/voice-transcript.{json,srt,txt}`. The medium pass hallucinated one phrase absent from the small/focused passes; it is excluded.
2. `python3 video/tools/captions_v2.py` produces 47 reviewed phrase captions. It verifies that its reviewed phrase list preserves every corrected ASR word. If the recording changes, rerun transcription/review; the builder checks the recording hash against the caption report.
3. `node video/tools/prepare_v2.mjs` reuses branded v1 templates with draft/voice-credit labels removed. `node video/tools/safety_v2.mjs` captures the real production research safety note (read-only GET, no paid check) and enlarges it.
4. `python3 video/tools/build_v2.py` renders from `video/edit-v2.json`. Critical clips play at 1× then hold; only the two waiting clips run at 2–4×. Frame endpoint rounding keeps the total exactly 4,740 frames. Clean audio is one continuous stream, highpass60Hz + gentle4dB denoise + approximately−16LUFS normalization; only0.133s tail padding, no audio tempo changes or word cuts.
5. `python3 video/tools/verify_v2.py` checks the actual encoded codecs, every-frame/sample decode, caption transcript/bounds, audio envelope alignment, loudness and QR. It also makes four one-second-sample timelines in `video/work/v2/` for visual review. These checks support review; they do not certify every sub-frame visual detail or replace listening.
6. After verification, copy the five named v2 outputs locally to the home project's `video/out/`. `build_v2.py --publish` also does this: it rebuilds, runs verification on that exact encode, then copies all five outputs. It never copies an older PASS report. V1 files remain unchanged.

The spoken closing URL omits “get.” Vedhanth explicitly approved keeping his voice unchanged while showing the working **getsecondlook.vercel.app** address and QR. Captions retain the spoken URL. Other small changes from SCRIPT.md, including “When I gave an answer,” are retained as spoken. The NIH result remains clearly labelled historical first-version research; the softgel limitation is labelled previously recorded evidence.

V2 deliverables: `second-look-demo-v2.mp4`, `contact-sheet-v2.png`, `captions-v2.srt`, `render-manifest-v2.json`, `verification-v2.json`. All remain local and ignored. Only source/config/docs and a small verification summary enter git.

## V1 draft archive

Current output: `video/out/second-look-demo.mp4`, 1920×1080, 30fps, H.264/AAC. The current cut is a **draft** because the supplied bottle take has no flip and numbers the wrong pill 4 while the verbatim script says 5. The draft clearly labels that section. The after-flip card uses the genuine previously recorded production result, explicitly labelled; no result is fabricated.

## Local setup

- macOS `say`, voice Samantha; Homebrew `ffmpeg-full` for subtitles/libass, Python3, Node and this repo's dependencies.
- `video/raw` points at the home project's `video/raw` directory; never commit it.
- Snapshot the planner's current `docs/SCRIPT.md` to `video/work/script-source.md`. This preserves uncommitted planner edits without changing their file.
- Local inputs, work files and output are git-ignored. Encoded output is also copied into the home project's `video/out` for Vedhanth.

```sh
npm install --prefix video/work/qr-tools --ignore-scripts --no-audit --no-fund jsqr@1.4.0 pngjs@7.0.0
python3 video/tools/narration.py
node video/tools/assets.mjs
node video/tools/details.mjs
python3 video/tools/build.py --publish
python3 video/tools/verify.py
```

The voiceover is every word of the Voiceover column, in order. Local caption audio chunks are generated with Samantha at168, slowed with pitch-preserving0.90 tempo, then placed against the matching captions. The finished script is approximately2:40. No source audio or music is mixed in. The output voiceover is `video/out/voiceover.aiff`.

## Replace shot3

Drop `shot3-bottle-check.mp4` into the home `video/raw` folder; `edit.json` auto-selects it. Or change **one line** (`bottle_file`) in `video/edit.json`, or run:

```sh
python3 video/tools/build.py --bottle shot3-bottle-check.mp4 --publish
```

A filename swap never proves unseen footage is ready. Review its ranges in `video/edit.json`: remove waiting/retry screens, confirm stable pill5 and the actual flip-to-amoxicillin sequence. Until that sequence is supplied, the separate flip card remains explicitly labelled as a previously recorded result. Regenerate the card(s) and revise that section to the new footage before upload. Draft indicators must remain until those checks pass. No video is uploaded by these tools.

A supplied `video/raw/voiceover.mp3` takes precedence when rebuilding and adds the ElevenLabs end-card credit when regenerating assets. That audio's caption timing requires review; the current word-exact timing is verified for the generated macOS narration. No external recording was present for this render.

## Evidence and privacy

- `video/out/render-manifest.json`: timeline, source ranges, captured production URLs and draft limitations.
- `video/out/verification.json`: actual file codecs/duration, full decode, caption text, loudness, QR decode and source hashes.
- `video/out/contact-sheet.png`: six sampled encoded frames.
- `video/out/captions.srt`: separate transcript/captions as well as burned-in captions.
- Production captures use GETs only; paid check endpoints are blocked. The genuine after-flip share and earlier softgel screenshot are labelled as recorded evidence.
- Phone status/Safari bars and the pouring shot's monitor are cropped; no faces or notifications in the selected ranges. Demo labels are fictional. Original audio and location metadata are dropped.
- Statistics retain study/date attribution. The NIH numbers are historical pill-v2 single-pill results, not whole-bottle validation.

Do not stage raw footage, work files, final MP4/audio or contact sheet. Do not upload the video; Vedhanth handles YouTube.

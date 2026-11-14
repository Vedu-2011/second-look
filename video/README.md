# Demo video edit

This branch contains the reproducible local editor, not the raw media or encoded video. No application code changes.

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

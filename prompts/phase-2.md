# Phase 2 — Claude reads the photos; /check does a real check end to end

Read first: ~/Hackathons/CLAUDE.md, ./CLAUDE.md, docs/ARCHITECTURE.md (incl. both "Decisions after…" sections),
docs/DESIGN.md. Plan in 3–5 bullets before coding.

## Goal
A person on a phone takes a photo of a label and a photo of one pill, taps "Check my pill", watches the real
steps tick, and gets the real ResultView — with THEIR photo on the "What's in your bottle" side.
AI only READS. The phase 1 engine still DECIDES. Nothing in the verdict ever comes from the model.

## API key
ANTHROPIC_API_KEY: Vedhanth will paste it to you in chat. Add it to Vercel (production + preview + development)
with `vercel env add`, and to .env.local. Never commit it, never log it, never send it to the browser. If he
hasn't given it yet, build everything with the SDK mocked, finish the tests, and list "needs key" in the handoff.

## Tasks
1. src/lib/ai/: Anthropic TS SDK client. Models from env with defaults: VISION_MODEL=claude-sonnet-5-5,
   TEXT_MODEL=claude-haiku-5-5 (check these IDs against the Anthropic models docs/list endpoint before relying on
   them). Prompts live in src/lib/ai/prompts/*.ts with a version string — phase 4's research eval must call the
   exact same readPill, so keep it a clean, importable function.
2. readLabel(image) → LabelReading, via tool use with a strict JSON schema, validated with zod (retry once on
   invalid output): drugName, strength, dosageForm, ndc (exactly as printed, or null), pharmacyName, directions,
   isPrescriptionLabel, per-field confidence 0–1. Do NOT extract the patient name. Prompt: transcribe only what is
   printed; never fill gaps from knowledge.
3. readPill(image) → PillReading (the exact shape /api/verify accepts): imprintSides[] exactly as seen (don't
   "correct" letters to a known imprint), imprintConfidence, colors[] using our FDA color words, colorConfidence,
   shape using our FDA shape words, shapeConfidence, form, pillVisible, multiplePills, photoProblems[] (blur,
   glare, too far, imprint side down), and a SEPARATE guess {drugName, strength} or null. Prompt must say the
   guess is only a lead that code verifies.
4. Images: client-side resize to ≤1600 px long edge, JPEG ~0.85, honour EXIF orientation; accept image/*;
   friendly error for HEIC/unsupported/too big. Never store photos server-side.
5. POST /api/check (multipart or base64 JSON): readLabel and readPill IN PARALLEL → runCheck → explain. Stream
   progress to the client (SSE or chunked NDJSON) with real step events matching CheckingSteps: label read, pill
   read, FDA lookup, compare. Include timings per step in the final payload.
   - Early exits with friendly, specific copy + retake buttons: not a prescription/medicine label, can't read the
     drug name, no pill visible, more than one pill, imprint side probably facing down.
6. explain (TEXT_MODEL): from the verdict facts JSON only, write (a) a 1–2 sentence plain summary and (b) for
   MISMATCH/UNSURE a short "What to say when you call your pharmacy" script (for MATCH/SAME_MEDICINE: one calm
   line). GUARD: reject any output that mentions a drug name, strength, imprint, NDC or number not present in the
   facts, or that gives dosing/medical advice → use the template text instead. Unit-test the guard hard.
7. Results: save the result JSON (no photos, no patient data) in Redis `sl:result:<id>` for 7 days → shareable
   /result/[id] page rendering ResultView (with drawings instead of the photo, since photos aren't stored).
8. /check wired for real, to DESIGN.md: step 1 label photo → step 2 pill photo (with the tip "one pill, plain
   surface, letters facing up, good light") → "Check my pill" → live CheckingSteps → ResultView with the user's
   pill photo (and the AI's reading shown as small chips: "We read: I2 · orange · oval"). Retake buttons on
   UNSURE. "Copy what to say" button for the script. Remove the phase 0 "preview" note.
9. Protect the credits: simple per-IP rate limit in Redis (30 checks/hour, friendly message), max image size,
   and a global daily cap env var (DAILY_CHECK_CAP, default 500).
10. Testing without our pills yet:
   - Make 3 realistic made-up pharmacy label images yourself (render HTML → PNG in your browser pane: fictional
     pharmacy "Maple Street Pharmacy", fictional patient "Alex Rivera", real drug/strength/NDC for our 3 scenarios
     from docs/ARCHITECTURE.md). Save under test-images/labels/.
   - Download a handful of real pill photos for I2, L484 and Advil-type tablets from the NIH dataset
     (https://data.lhncbc.nlm.nih.gov/public/Pills/index.html) — consumer photos and references — into
     test-images/pills/ with a SOURCES.md. If you can't find a needed pill there, note it.
   - `npm run smoke:ai` runs readLabel + readPill + full /api/check on those images LIVE and prints readings,
     verdicts, timings and token cost. Run it; paste output in the handoff.
11. Tests: vitest with the SDK mocked — schema validation + retry, early exits, guard (many cases), SSE/NDJSON event
   order, rate limit, /result/[id]. Keep all 108 existing tests green.
12. Screenshots 375 + 1440 of the full /check flow with a real result (all 3 scenarios using test images) and one
   UNSURE retake → docs/screenshots/phase-2/. Fix anything not beautiful.
13. Codex review, fix real findings, commit, push (auto-deploys). HANDOFF entry at the TOP of HANDOFF.md.

## Done when
On production, uploading the made-up label + a real pill photo gives the correct verdict for all 3 scenarios,
streamed live, in ~10–15 s, with the AI never deciding the verdict. smoke:ai output in the handoff.

## How to test
1. Phone-size /check on production: label (MATCH label) + I2 orange oval photo → Matches, photo shown, chips right.
2. Wrong-pill label + L484 photo → Doesn't match, "This imprint belongs to Acetaminophen 500 mg".
3. A blurry or no-pill photo → friendly retake message, nothing crashes.
4. Explanation guard: a forced fake model reply mentioning "Tylenol 650 mg" not in the facts → template used.
5. 31st check in an hour from one IP → friendly rate-limit message.
6. /result/<id> link opens the same result in a fresh browser.

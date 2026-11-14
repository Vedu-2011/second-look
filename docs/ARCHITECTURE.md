# ARCHITECTURE.md — Second Look

## One line
Snap the pharmacy label, snap one pill → Second Look tells you in ~10 seconds whether the pill in your hand is
the medicine on your label, and shows the FDA record as proof.

## Why it matters (cite exactly like this — never invent numbers)
- ~51.5 million dispensing errors a year in US community pharmacies (1.7% of ~3 billion prescriptions) —
  Flynn EA et al., "National observational study of prescription dispensing accuracy and safety in 50
  pharmacies", J Am Pharm Assoc 2003. ~1,115 potentially important errors per 1 million prescriptions.
- When a refill's pill color changes, patients have 34% higher odds of stopping their heart medicine; shape
  change 66% — Kesselheim AS et al., Annals of Internal Medicine 2014. (Why our "different maker, same medicine"
  verdict matters: reassurance keeps people taking their meds.)
- Say "errors we can help catch", never "errors prevented".

## Who it's for
Older adults on several medicines, and the adult kids / caregivers who manage them. People who can't easily
read small print or English labels.

## The core rule: AI reads, code decides
- Claude (vision) only READS: the label text and what's on the pill. It also writes the plain-English
  explanation at the end — using only facts the code produced.
- Deterministic code DECIDES: looks up the FDA records, normalizes imprints, compares features, picks the verdict.
- Any AI explanation that mentions a drug, strength or imprint the code did not produce is thrown away and a
  plain template is used instead. (Same trust layer that won Shadow Buyer at Mini VikingHacks.)

## Real data sources (all free, no keys) — tested by the planner on Nov 8, 2026
1. NLM RxNav / RxNorm (https://rxnav.nlm.nih.gov/REST/…)
   - approximateTerm.json?term=ibuprofen%20200%20mg%20oral%20tablet&maxEntries=3 → rxcui 310965
   - ndcproperties.json?id=<rxcui>&ndcstatus=active → EVERY product (all manufacturers) for that drug+strength,
     each with: ndc9/ndc10, rxcui, splSetIdItem, and propertyConceptList with IMPRINT_CODE, COLOR (FDA code e.g.
     C48331), COLORTEXT ("ORANGE"), SHAPE (code e.g. C48348), SHAPETEXT, SIZE ("10 mm"), SCORE, LABELER,
     MARKETING_STATUS. Ibuprofen 200 mg tablet = 1,385 products; acetaminophen 500 mg tablet (rxcui 198440)
     = 1,176 products.
   - ndcproperties.json?id=0113-0517 → the single product for an NDC (works with NDC from the label).
   - Imprints use ";" between sides ("44;291", "G;2"). Top ibuprofen 200 mg imprints: I2, G2, 44;291.
     Top acetaminophen 500 mg: L484, G1.
   - Note: the same NDC can appear several times (duplicate rows) — dedupe by ndc9.
2. FDA DailyMed (https://dailymed.nlm.nih.gov/dailymed/services/v2/…)
   - spls.json?drug_name=… and spls/<setid>.xml → full label, published_date, and the same SPL appearance fields
     (SPLCOLOR, SPLSHAPE, SPLSIZE, SPLIMPRINT, SPLSCORE). Use it for the evidence link and "published" date:
     https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=<setid>
   - The old v1 imprintdata endpoint is DEAD — don't use it.
3. NIH/NLM Pill Image Recognition Challenge dataset (https://pir.nlm.nih.gov/challenge/) — for the research
   evaluation only (phase 4).
Cache every RxNav/DailyMed response in Upstash Redis for 24h (key by URL). Show "Checked against FDA data on
<date>" on results.

## The check pipeline (POST /api/check)
Input: label photo + pill photo (or a sample id). Max ~4 MB each, resized client-side to ≤1600px long edge.
1. readLabel (Claude vision, structured output via a tool/JSON schema): drugName, strength, dosageForm, ndc (if
   printed), pharmacyName, directions, confidence per field (0–1). Patient name is NOT extracted or stored.
2. readPill (Claude vision, structured output): imprint as seen per side, colors[], shape, scored, form
   (tablet/capsule), imprintConfidence, colorConfidence, shapeConfidence, plus modelGuess {drugName, strength}
   — a guess used ONLY as a lead for code to verify.
3. resolveExpected (code): label NDC → ndcproperties by NDC (the exact product on the label). Then rxcui →
   ndcproperties by rxcui (all makers of the same drug+strength). If no NDC: approximateTerm from
   drugName+strength+form → rxcui.
4. match (code, pure functions, heavily unit-tested):
   - normalizeImprint: uppercase, strip spaces/dashes/dots, split sides on ";", sort sides; compare with
     confusables (O↔0, I↔1↔L, S↔5, B↔8, Z↔2) as a "close" match, exact as "exact".
   - colors: map FDA codes → our color names; shape: FDA codes → shape names (keep tables in lib/fda/codes.ts).
   - Compare the pill to (a) the label's exact NDC product, then (b) every product with the same rxcui.
5. identify the mismatch (code): if the imprint isn't in the label's drug, take readPill.modelGuess →
   approximateTerm → rxcui2 → ndcproperties → only if the imprint really exists there do we say
   "This pill matches the FDA record for <drug strength> (<labeler>)". Otherwise say we couldn't tell what it is.
6. verdict (code):
   - MATCH — imprint matches the label's exact product (or, with no NDC, a product of that drug+strength) and
     color + shape agree.
   - SAME_MEDICINE_DIFFERENT_MAKER — label has an NDC, the pill isn't that product, but imprint+color+shape match
     another maker's product of the SAME drug+strength. Shown green with "looks different, same medicine".
   - MISMATCH — imprint read with good confidence and NOT found in any product of the label's drug+strength.
   - UNSURE — low confidence, no imprint, blurry photo, no FDA record, or imprint matches but color/shape don't.
     Always: "We can't tell. Ask your pharmacist." Abstaining is a feature.
7. explain (Claude, text only): plain-English summary + "what to say when you call your pharmacy" script,
   given only the computed facts JSON. Guard: reject output that mentions drug/strength/imprint not in the facts.
Output: { verdict, label, pill, expected (FDA product), candidates, identifiedAs?, features[{name, expected,
found, result}], evidence[{source, setid, url, publishedDate}], explanation, script, timings }.
Progress: stream step events (server-sent events or a polling job id) so the "Checking…" list ticks for real.

## Models
- Reading photos: claude-sonnet-5-5 (best at tiny imprints). Explanation: claude-haiku-5-5 (cheap, fast).
- Research eval runs both models on the same images (Batch API, half price) to compare.
- Server-side only; ANTHROPIC_API_KEY in Vercel env + .env.local. Never expose it to the browser.

## Pages
- /            home — the problem in one line with the cited stat, "Check a bottle", "Try a sample bottle"
- /check       2-step capture (label → pill), then live "Checking…", then the result
- /samples     3 real demo bottles we photographed: match, mismatch, different maker same medicine
- /sources     the real data sources, what each is used for, last checked date
- /research    the NIH benchmark results (phase 4)
- /style       internal design gallery of every component and verdict state (for screenshots/review)

## Stack
Next.js 16 (App Router, TypeScript) · Tailwind v4 · shadcn/ui restyled to docs/DESIGN.md · Anthropic TS SDK ·
Upstash Redis (Vercel Marketplace, env prefix KV_) · vitest · recharts (research page) · Vercel.
Repo: github.com/Vedu-2011/second-look — PUBLIC (DSH requires a public repo).

## Safety
- Verification, never diagnosis or dosing advice. MISMATCH always says "Don't take this. Call your pharmacist."
  Never "take X instead".
- Tablets and capsules only. Liquids, inhalers, injectables, compounded meds → "not supported yet".
- No photo storage by default; no patient names stored. Demo labels use a made-up patient.
- Footer: "Second Look helps you spot a possible mix-up. It doesn't replace your pharmacist."

## Demo bottles (real over-the-counter pills, printed made-up patient labels)
1. MATCH: label "Ibuprofen 200 mg" with the store-brand product's real NDC, store-brand pills inside.
2. DIFFERENT MAKER, SAME MEDICINE: label with Advil's NDC, store-brand ibuprofen 200 mg inside.
3. MISMATCH: label "Ibuprofen 200 mg", acetaminophen 500 mg (L484-type) inside.

## Decisions after phase 0 (planner, Nov 9)
- Redis: sharing the LineLess Upstash DB is fine (free). All Second Look keys use the "sl:" prefix.
- Advil on demo labels: NDC 0573-0160 (plain pinkish-brown 15 mm oval, imprint "Advil"). Never use discontinued
  products (e.g. I2 round 0113-0074) for demos.
- Size can't be measured from one phone photo (no scale), so size is shown as the FDA value only ("not measured"),
  never as a pass/fail. Checks compare imprint, color and shape. Copy: "Comparing with FDA records".
- Two-sided pills: show "Other side: …" text under the drawing for now; front+back drawing is a phase 5 extra.
- FDA "CAPSULE" shape is also used for caplet TABLETS — treat oval / capsule / oblong as close shapes.
- NIH dataset lives at https://data.lhncbc.nlm.nih.gov/public/Pills/index.html (paper: Yaniv et al. 2016, PMID 29854569).

## Decisions after phase 1 (planner, Nov 9)
- Every demo label gets an NDC (real pharmacy labels always print one). The exact NDCs are set once Vedhanth buys
  the pills: the MATCH bottle's label must carry the NDC printed on the store bottle he actually buys. The wrong-pill
  label uses an ibuprofen 200 mg NDC that looks like the other bottles (default 0113-0517, orange oval I2).
- /dev/check becomes a public feature in phase 3: "No camera? Type what's on your pill" (linked from /check),
  polished to DESIGN.md. Until then keep it noindex.
- Real finding for the deck/Devpost: among active ibuprofen 200 mg tablets, the most common look is a BROWN ROUND
  "I2" (38 products), not the orange oval — the same medicine comes in many looks, which is exactly why patients
  get confused (Kesselheim). Use with the exact counts from the app.

## Decisions after phase 8 (planner-authorized addendum, Nov 10)
- (Superseded by addendum 3 below.) Earlier real demo bottles: Kirkland ibuprofen 200 mg blue capsule IB1, NDC 63981-598, Costco; Advil Liqui-Gels label NDC 0573-0169, green capsule Advil; mismatched pill Tylenol Extra Strength white oval TYLENOL / 500, NDC 50580-937. Labels use capsule form for ibuprofen. These replace the earlier tablet demos, retained as regression fixtures.
- Live RxNav verified 310964 (generic capsule) and 731533 (Advil capsule) in the same group, 211 deduplicated products on Nov 10. Kirkland exact package is COMPLETED: keep MATCH and add a calm no-longer-marketed note.
- A pill appearance can be shared by many sellers. Report every FDA-listed product with the selected record's complete imprint, color and shape; deduplicate by product code and sellers by normalized name; put the label NDC first. Do not infer a unique manufacturer or use this presentation grouping to change the verdict. Unknown sellers are disclosed.
- Demo patient/pharmacy details remain fictional. Photos are optional and must never be fabricated. Printed IB1 needs close, angled light; TYLENOL / 500 demonstrates the flip step.

## Decisions after phase 8 addenda 2 and 3 (planner, Nov 10)
- Final demo set (live RxNav verified Nov 10):
  - MATCH: Metformin 1,000 mg tablet label, NDC 70010-065, Granules; pill "G" / "12" (white oval, 19 mm).
  - SAME_MEDICINE_DIFFERENT_MAKER: Advil Liqui-Gels (ibuprofen) 200 mg capsule label, NDC 0573-0169, Haleon; pill is
    a Kirkland softgel printed "IB 200". Result says "sold by N companies"; it never names one maker.
  - MISMATCH: Metformin label; pill amoxicillin "93". "93" alone never names a medicine: it says MISMATCH and asks
    for a flip. After the flip ("93" / "2263") it is identified as amoxicillin 500 mg; Teva's own record
    (0093-2263) is DROPPED, Chartwell RX (62135-084) is active with the same imprint, and Teva is in the seller list.
  - Bottle (phase 9): Metformin label, 9 × "G 12" + 1 amoxicillin; bottle RED, amoxicillin flagged.
- Identification needs a whole imprint (every side). It still works when the only FDA record is DROPPED, with the
  calm "no longer marketed" note.
- Color: blue, turquoise and green are CLOSE (translucent softgels). FDA color text in parentheses, such as
  "blue(green)" or "green(Transparent green to blue green)", adds allowed shades. Color alone never turns a
  mismatch into a match; it can only move an imprint match between MATCH and UNSURE.
- Pill reading prompt pill-v3: printed ink counts as an imprint; faint print on softgels is never treated as blank.
  If it can't be read, the result stays UNSURE. Research numbers are from the frozen pill-v2 run.
- Finding: the FDA record for the NDC on our Kirkland bottle (63981-598) lists imprint "IB1", but the softgels inside
  say "IB 200". Second Look flags this (SAME_MEDICINE, different listing) instead of calling it a match.
- Earlier demo NDCs (Kirkland 63981-598, Tylenol 50580-937, older tablet fixtures) stay as regression fixtures.

## Decisions after phase 10 (builder, Nov 10) — pour and snap
- Bottle-level rules, separate from the frozen single-pill benchmark (research numbers untouched).
- Segmentation models the background locally (per-cell medians, smoothed), so dark paper with folds, a gradient or a
  table strip works. Large edge-touching regions ("surfaces": >1% of the photo, spanning ≥40% of a side) are treated
  as background; if they cover >35% of the photo we ask for a plainer surface.
- Touching pills and pills cut off at the edge no longer fail the photo: they come back as circled clumps, never green.
- Wrong pill from either side: one confident side that no listed version of the label's medicine has → MISMATCH.
  Identifying the wrong pill needs both sides (recordedLead fallback lets identification work after a flip).
- Look-alike groups (src/lib/bottle/lookalike.ts): per pill relative area, aspect, mean Lab color. Odd = outside
  median ± 4 × robust SD of the same photo. Floors size 15% / shape 12% / color 8 (L counts half); caps 40% / 30% / 18.
  Needs ≥3 pills and a 60% main group. Floors sit above the noise among identical pills in the harsh drawn scene
  (size 8.6%, shape 0.5%, color 0); dev composites' odd pills differ by 13–36% / 66–83% / 21–63. Set from drawn
  scenes and composites, not the demo photos. Odd → WARNING at least, and the first pill asked about.
- Face-down: blank face + looks like the confirmed pills + the label product has an imprint → "writing face-down",
  not confirmed. The FDA ";" format can't say which face is blank, so any imprinted product may have a blank face.
- Max 3 flip asks; more than that → "Give the pills a gentle shake, pour again, snap again."
- Flip and snap again: similarity-transform match by position (several starts, mutual nearest neighbours within
  min(0.35 × median gap, pill size)). Re-read only asked or newly separated pills; any lost, added (outside a former
  clump) or changed pill → fresh full check, said in the result. Quota max(1, ceil(rereads / 5)).
- No score-line feature (not cheap enough to do reliably).
- Real photos (Nov 10): the 10-pill bottle came back WARNING, not the expected RED: the amoxicillin read "22 63" at
  confidence 0.6 (below the engine's bar) so it stayed "can't tell", but the look-alike check singled it out as a
  different color and asked to flip it first. Three-pills-close photo with the metformin label → RED as expected.
  No thresholds were tuned to these photos.

## Decisions after phase 10b safety review (Codex, Nov 11)
- Position, size, shape and mean color cannot prove pill identity. A selective follow-up reads asked pills first;
  other readings are explicitly unconfirmed history, with gray markers. Before a new green bottle, every carried
  imprint is read again. Incremental quota is reserved before those extra readers. A red selective follow-up may
  name the wrong pill from conservative combined views while the other positions remain history.
- A confident mismatch stays red across its reverse view, even if that reverse is unreadable/conflicting. A flip
  on red is for identification only. Both view confidences are retained through mergePillViews; never boosted.
- Removed circled foreground remains an unresolved obligation across follow-ups. Detected edge foreground,
  including thin slivers or apparent surface strips, stays unchecked rather than disappearing. This deliberately
  increases false warnings on some backgrounds; use a plain surface fully in frame. Low-contrast objects can still
  be missed: inspect numbering. Detection cannot prove that every physical pill was photographed.
- Bottle confirmation additionally requires readable color/shape and imprint confidence. Single-pill engine,
  matcher thresholds, AI prompts and frozen research artifacts are unchanged in this phase.
- Public result IDs are read-only capabilities. API responses separately return a private continuation token;
  only its SHA256 hash is stored outside the public result. The browser holds the token in current flow state;
  no token is included in shared URLs or shared result data. Old links remain readable but cannot be continued.
- The historical pill-v2 benchmark does not establish current reader/color/identification performance. Look-alike
  sensitivity/false-warning rates on independent real bottle photos remain unmeasured. No thresholds were tuned
  on the phase 10b photos.

## Decisions after phase 10c display polish (Codex, Nov 11)
- Approved phases 9–10b merged to main before this separate preview branch. This polish changes presentation only.
- A carried reading records previousVerdict as display provenance. Its actual result remains UNSURE and cannot
  contribute to current bottle confirmation. A first-photo match is outlined softly and labeled "Matched in your
  first photo"; unknown/uncertain provenance stays a question mark. No inference from confidence or appearance.
- The saved phase-10b demo's provenance was backfilled from its recorded before/after pair, with exact reading
  correspondence checked. Only previousVerdict added; a compare-and-set preserves existing data and remaining TTL.
- Shared dots and flip rings use the same center/clamp anchor. Live rings surround the original normalized pill
  crop; live badges stay outside the imprint. Warning/uncertain rows appear first; unflagged matches and earlier
  matches expand on demand. A summary's current and earlier counts are explicitly separate.
- Pill 10 in the saved before photo is still an engine MATCH with a photo-only SHAPE outlier warning: aspect
  1.553 vs median 1.851, log deviation 0.17534 > tolerance 0.15839. Size and color did not trigger. No threshold,
  prompt, engine, segmentation, quota or follow-up planning rule changed.

## Decisions for phase 11, before the real-photo test (Codex, Nov 11)
- Bottle-only consensus requires at least two CURRENT imprint-confirmed pills in the same look-alike group, all
  sharing the same complete FDA imprint. Any red pill, odd/appearance warning, clump/cutoff, unresolved region or
  conflicting fragment blocks support. Literal fragments only, no confusable folding. Carried readings never
  confirm or acquire consensus. Inferred per-pill engine verdicts stay UNSURE; all-confirmed remains MATCH;
  all-current-confirmed-or-supported can be separate LOOKS_RIGHT, explicitly appearance support only.
- Bottle borderline confidence [.5,.7): at most five independent second reader calls, with different pixels from
  a 2x upscale. Exact symmetric full normalized agreement, visible single pill, consistent appearance and >=.5
  confidence on both readings meet the unchanged .7 imprint bar. Both original readings/confidences are recorded.
  Agreement on only a known proper fragment (e.g. IB2 in IB200) is recorded but stays unconfirmed; it may support
  appearance consensus. This avoids mistaking an agreed partial transcription for a complete imprint. No red
  verdict is overridden. Secondary calls have no SDK retry and at most one generation attempt.
- Quota reserves all primary+secondary calls in groups of five, before secondary calls start. Max20 pills+5 extra
  calls. Reservations serialize across workers and across follow-up verification. On failure, workers drain before
  closing the stream, so there are no late enqueue attempts or new readers after quota denial.
- Segmentation constants selected on SYNTHETIC controls: low-light L<65, saturation >border+.12, green/blue excess
  >border+6 RGB, Lab chroma >border+4. Existing Lab-distance mask retained. Controls include faint translucent gels
  and gray noise. Two-marker splitting requires exactly two distance-transform peaks >=.75 max, separation >=1.6
  max radius, neck saddle <=.65 min peak, area ratio<=1.5, both convex solidity>=.94, aspect<=3.3, no remaining neck.
  Otherwise retain dashed unchecked regions. White/black/yellow/texture, three-pill clumps, unequal pairs and
  rotated pairs are controls. Existing development composites are functional tests, not new accuracy evidence.
- Coaching before ANY AI: median working-image pill length <2.5% long edge advises moving closer; >=2 unchecked
  regions advises spreading. Retake is primary, Check anyway secondary; no label/crop AI or paid-check quota until
  continuation. Free preparation has separate 30/min/IP throttling. Any invalid/over20 image still rejects.
- Freeze before looking at or running the supplied real user photo. One new live run under .30 durable cap; no
  threshold or prompt tuning on that photo. Known Bionpharma NDC69452-212 label is supplied, not AI label reading.
  Frozen single-pill engine, matcher constants, AI prompts and benchmark files stay unchanged.

## Decisions in phase 11b (Claude Code, Nov 11) — segmentation revert, then feature freeze
- segment.ts is back to the pre-phase-11 behavior (78bfa98). The phase 11 low-light chroma cue and the touching-pill
  split are NOT shipped: they passed synthetic tests but regressed on the only real hard photo (user test: 6 numbered
  + 4 circled before → 4 + 5 with phase 11). split-touching.ts stays in the repo, unwired ("not shipped: regressed on
  real photo"). Touching pills stay circled and unchecked; we never guess them apart.
- Everything else from phase 11 stays: consensus / "Looks right", double-read, free coaching, quota, display.
- Free segmenter check on every real photo (scripts/segment-real.ts), phase 11 → after revert: metformin bottle
  10+0 → 10+0; flipped 10+0 → 10+0; bottle-93-upside-down 10+0 → 10+0; three-pills-close 3+0 → 3+0;
  tylenol-close 1+1 cutoff → same; user test 4+5 → 6+4 (coaching "Spread them out so none touch." both times;
  metformin bottle gets no coaching). Locked by a test. These photos are not held-out anymore.
- Wording (display only): a wrong pill's row leads with its print — "Its print says 93 / 2263 — that's Amoxicillin
  500 mg, not your Metformin." / "Its print says 93 — that's not on any metformin 1,000 mg." — and the "different
  from the others" line comes after.
- Feature freeze after this phase: only bug fixes, video, Devpost and deck.

## Decisions in phase 11c (Claude Code, Nov 12) — piles are read, and a clean result screen
- Separate pills: the proven segmenter, unchanged. Each touching region (largest first, at most 3 per photo) is cropped
  with padding at full resolution and read ONCE by a new prompt, `pill-group-v1` (src/lib/ai/prompts/read-pill-group.ts;
  read-pill / pill-v3 untouched). It returns one entry per visible pill (center, box, the usual fields, `partlyHidden`)
  plus `pileCount`, `countConfidence`, `somePillsMayBeHidden`. Each entry becomes an ordinary numbered pill
  (`fromPile: true`) through the same engine. A pile read costs 5 units of quota. A failed pile read leaves the region
  circled "Not read".
- Partly hidden pills are capped at 0.6 imprint confidence (below the engine's 0.7), so they are never confirmed or
  contradicted alone. Borderline pile pills get the usual second read with the single-pill reader.
- Never green with a pile: at best "Looks right" plus "a pill hidden under another can't be seen". Hidden pills,
  count confidence < 0.6, or a count above what was read → UNSURE "give the pile a shake and snap again". A MISMATCH
  from a pile pill is red like any other.
- When unread regions are most of the photo, the title leads with it: "We could read N of about M pills."
- The "Spread them out" pre-check is gone; "Move closer" stays. A small, much-darker cutoff at the edge is a note
  ("Something at the edge of the photo wasn't checked"), not a circle, and still blocks green.
- Shape-only "looks different" on a confirmed imprint is a ✓ with "probably the angle", not "!".
- Result screen: 28/32 px pins placed just outside each pill and pushed apart (`layoutPins`); tapping the pin or the
  pill opens its row. The legend lists every mark on screen, including the dashed "Not read" circle. Red mode (any
  MISMATCH) shows only the wrong pill's row plus one line about the others; other markers become small gray dots (✓
  kept); the rest sit in a collapsed "See the other pills".
- Real check (scripts/check-phase11c.ts): the metformin bottle stays red on "93". On the user-test pour, the group
  reader read 3 piles (1 of ~2, 2 of 2, 1 of ~2). It also read one Ibuprofen softgel as "TB 200" at 0.8, giving a false
  "doesn't match" on top of the real Tylenol mismatch. Pile readings of small printed softgels are not reliable.

## Decisions in phase 11d (Claude Code, Nov 12) — no false reds from a one-letter misread
- A MISMATCH whose read print is exactly ONE character away from the label's own FDA imprint (spaces, case and
  punctuation ignored; whole imprint or either side), e.g. TB 200 / JB 200 / IB 260 / ID 200 vs IB 200, gets one
  independent second read before it can be red: same reader, 2× upscale of that pill's own crop (pile pills too).
  Same near-miss text again (confidence ≥ 0.5) → stays red. Label imprint, other text, nothing, a failed read, or no
  extra reads left (max 5 per photo, counted in quota) → UNSURE: "This might say IB 200, but we couldn't read it
  clearly. Check it with your pharmacist." Never MATCH from this path. Clearly different prints (93, TYLENOL 500) are
  red exactly as before, with no second read. A mismatch carried from the first photo of a follow-up still stands.
- A second read that fails or is refused is now marked `failed` and says so ("We tried to read it a second time but
  couldn't…"); it never confirms a pill.
- Real replay: the user-test pile pill "TB 200" → second read "IB 200" → UNSURE; Tylenol still red; metformin still
  red on "93". The earlier failed second read (metformin pill 1) worked on retry ("G 12" twice): a passing API error.

## Decisions in phase 11e (Claude Code, Nov 12) — every mark sits ON its pill
- Bug (Vedhanth's phone, Advil + Tylenol on wood): phase 11c's "pushed apart" pins could drift next to a different
  pill (the red "5 ×" sat beside a dashed softgel) and gray dots floated in empty space. Pins are gone.
- Each pill now gets a ring drawn ON it: a rotated rounded rectangle from the pill's own silhouette (segmenter
  `outlines`: image-moment center, angle, length, width; detection unchanged) or, for pile pills and older saved
  results, the capsule that fills its box. Colors: red = doesn't match (thick, soft red glow; nothing else is red),
  soft green = matches, amber = looks different, gray = not fully checked, dashed orange = not read.
- A small number chip (24/28 px) touches the ring on the side with the most open space. It is placed only where its
  own pill is strictly the nearest pill, it covers no other pill, no unread region and no other chip; otherwise a
  number-less dot on the ring, or nothing (the number stays in the list). Tested on the real metformin bottle, the
  user-test pour, Vedhanth's stored 4 AM check (src/lib/bottle/fixtures/phase11e-real-marks.json) and 50 synthetic
  crowded scenes, at phone and desktop widths, normal and red mode.
- Red mode: only the wrong pill keeps its chip; other rings are dimmed, no chips.
- Pile pills whose box can't be trusted (the reader's box missed its own center, > 3× a separate pill's box, or mostly
  on top of another pill's box) get no mark at all; the summary says how many weren't marked.
- Tapping a ring (the labelled button) or its chip opens that pill's row. The share page draws the same shapes.

## Decisions in phase 11e option (a) (Claude Code, Nov 12) — one-pill "touching" regions get a single read
- Cause (Vedhanth's 4 AM check): the segmenter flags a region as "touching" by shape (low solidity, a neck, or thin),
  not size, so a single softgel can be flagged. With 5 such regions and the 3-pile cap, two single softgels stayed
  dashed "Not read".
- A touching region of 0.5–1.3 typical separate pills (`oneSizedRegion`, `ONE_PILL_REGION` 1.3,
  `ONE_PILL_REGION_MIN` 0.5) is cropped like a separate pill and read with the single-pill reader (1 quota unit), then
  goes through the same second read / engine / near-miss check. It never uses a pile slot.
- If that reader says multiplePills, no pill, or fails, the region stays "Not read" (dashed, blocks green). A region
  read as one is `readAsOne`; its pill is `fromRegion`.
- Specks under half a pill are never single-read or pile-read; they stay "Not read", as before.

## Phase 11f bug fixes (Codex, Nov 12)
- A valid bottle plan can reserve 20 single reads + three pile reads at five equivalents each + five second reads =40 reader-equivalents /8 check units. The old helper rejected an increment >4 before checking counters, producing Invalid check reservation. It now accepts integer reservations1–8; hourly30 and daily shared atomic caps remain unchanged. Regression:11 separate +3 piles plans26 equivalents and requests five extra units after the initial one.
- Bottle failures log error name/message/stack server-side, without request bodies/photos/readings/SDK headers. Only FdaError gets an FDA explanation; unknown errors say Something went wrong on our side checking this pill. Existing quota and AI-unavailable messages remain.
- Label data is still resolved once per bottle. URL-keyed in-flight cache coalesces Redis/network misses by NDC/rxcui; request-scoped guesses/metas remain shared. At most4 FDA HTTP requests/body reads per instance. One retry by default, exponential250ms base backoff, up to2s. Short Retry-After respected; longer cooldown fails clearly instead of retrying early or stalling the function. Failures are not cached.
- Distance coaching uses separate silhouette lengths/areas AND touching/cutoff region boxes, not the median separate pill. Region boxes conservatively overestimate foreground. Ignore objects <12 working pixels long or <64 working pixels area, then <0.3 of the median of the three largest object areas. Coach only if all of the three largest lengths are <4% frame long edge, summed foreground <1.5%, AND kept objects span <65% long edge. No spreading pre-check reintroduced. Detection, pill verification thresholds, prompts and research artifacts unchanged.
- Coaching constants frozen at7108417 on synthetic far/close/pile/speck controls before real audit. Far example lengths2%, foreground0.152%, span17.7% ->coach. Close9-pill spread lengths10%, foreground4.53%, span73.3% ->no coach. Close pile +8 small specks: specks ignored, large regions ->no coach. Real audit:15 image files,11 segment successfully, four label photos retake as too_many; no Move closer among eligible photos. This is a functional check, not a medical accuracy benchmark.
- Incident13:40–13:46 UTC could not be recovered at15:21 UTC: time-window logs returned400, broad queries returned no records. Verified Vercel team is Hobby, runtime retention1h per official docs. The invalid-reservation exception is reproduced on pre-fix code, not claimed to be a recovered production stack trace. No paid AI needed.

## Decisions in phase 11g (Claude Code, Nov 13) — a failure on our side never sends you back to the camera
- The incident (Fri Nov 13, ~10:30 PM PT): the pills photo "failed, retry" twice, then worked. Vercel logs
  (docs/screenshots/phase-11g/logs.txt) hold only the 3rd, successful POST (200, 12 AI reads). The 2 failures left no
  request, no error and no timeout: they never reached the function, so the phone's upload dropped (iOS reports a
  bare "Load failed"). The client then showed the raw message with only "Retake pills photo".
- Browser (`src/lib/bottle/retry.ts`, bottle-flow.tsx): a failure is "photo" (segmenter retake, 400, too large),
  "blocked" (429/403/404, quota) or "ours" (network drop, timeout, cut-off stream, 5xx, a server error marked
  `retryable`). "Ours" keeps both photos, says "That took too long on our side — trying again…" and resends the SAME
  photos once; if that fails too: "Try again" (same photos). Retake only for a photo problem.
- Server: a retry costs nothing twice. Readings (never photos) are cached 15 min per request scope (hash of every photo
  + previousId + checkAnyway); the n-th read of one image maps to the n-th cached reading, so a deliberate second read
  is still real and a follow-up photo always gets fresh reads. Quota those photos reserved is remembered 15 min (up to
  3 free retries).
- Diagnosis next time: the browser sends a tiny note to /api/client-error (kind, status, error name/message, attempt,
  timing, bytes, user agent; never photos or readings), so a failure that never reaches the server is in the logs.
- Time: a 17-pill photo is 17 reads in 4 rounds of 5 (scripted, mocked latency): ~40 s at a slow 10 s read.
  maxDuration 120 → 300 (Hobby max) as headroom; each AI request has a 45 s timeout (90 s for a pile read) and one SDK
  retry inside our two attempts, so one stuck read can't hold the check past the limit. Browser waits 305 s.

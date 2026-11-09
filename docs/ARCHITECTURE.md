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

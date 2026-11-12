# Demo video — Second Look (target 2:35, max 3:00) — v2, "pour and snap" (Nov 12)

Voiceover: AI voice (DSH allows AI). ElevenLabs on a parent's account (credit "Voiceover: elevenlabs.io" in the video
end card AND on Devpost), or the macOS fallback (a Premium voice like Ava, rendered by the builder with `say`).
Calm, warm, unhurried. ~330 words. Every claim below is checked against the app (see "Claim check" at the bottom).

| Time | On screen | Voiceover |
|---|---|---|
| 0:00–0:10 | Hands open a pharmacy bottle (the printed Maple Street label taped on) and pour 10 white pills onto a dark towel. | When your refill comes, do you check every pill? Most people don't. They pour them out and trust the bottle. |
| 0:10–0:24 | Big numbers, one at a time, small citations: "51.5 million dispensing errors a year" (Flynn et al.) → "34% / 66% higher odds of stopping heart medicine after a color / shape change" (Kesselheim et al.). | But US pharmacies make an estimated fifty-one and a half million dispensing errors a year. And when a refill just looks different, people stop taking it: thirty-four percent higher odds after a color change, sixty-six after a shape change. |
| 0:24–0:34 | Phone: getsecondlook.vercel.app home → /check "Check my pills". | This is Second Look. Snap your label, pour out your pills, take one photo. In about ten seconds, it checks every pill against the official FDA record for the medicine on your label. |
| 0:34–1:04 | PHONE SCREEN RECORDING: snap label → snap the 10 pills → checking steps → red result: "Pill 5 doesn't match your label." Zoom on the photo with numbered pills, pill 5 red. Then the row: "Its print says 93 — that's not on any metformin 1,000 mg." | Here's a metformin refill. Ten pills. One of them is amoxicillin, an antibiotic that looks almost the same: white, oval, about the same size. Would you notice? Second Look reads the letters on every pill and checks them against every FDA-listed version of metformin one thousand milligrams. Nine say G 12. Pill five says 93, and no metformin has that. So it's red: don't take any pills from this bottle, call your pharmacy. |
| 1:04–1:20 | PHONE: hand flips pill 5 in place → "Flip and snap again" → result: "Its print says 93 / 2263 — that's Amoxicillin 500 mg, not your Metformin." Other pills show "matched in your first photo". | Want to know what it is? Flip just that pill and snap again. It only reads pill five again: 93 on one side, 2263 on the other. That's amoxicillin, five hundred milligrams. |
| 1:20–1:36 | PHONE: "Check one pill" with the Advil Liqui-Gels label + one Kirkland "IB 200" softgel → "Same medicine, different maker" + seller list. | Not every different-looking pill is a mistake. This label says Advil, but the pill is a store brand. Second Look shows it's the same medicine from a different company, so you don't stop taking it for no reason. |
| 1:36–2:02 | Diagram: Label photo + Pills photo → Claude reads → FDA / NLM records → Code decides → answer. Then /sources page. | The rule we built it on: AI reads, code decides. Claude only reads what's printed on each pill, and its color and shape. Plain code compares that with real FDA and National Library of Medicine records and makes the call. If the AI isn't sure, it reads again, and if it still can't tell, the app says so instead of guessing. It only shows green when it has read every pill, and it never saves your photos. |
| 2:02–2:24 | /research page: results table, then the "found and fixed a safety bug" note. Then a quick shot of the teal softgels with "can't tell" rows. | We tested the first version of the pill reader on a hundred and fifty NIH pill photos it had never seen. When it gave an answer, it was right eighty-three out of eighty-eight times. Testing also caught a real safety bug: we fixed it and published the before and after. And we're honest about limits: shiny, see-through softgels are still hard to read. |
| 2:24–2:35 | Home page + URL + QR code. Small text: "Not medical advice. Always check with your pharmacist." End card: "Voiceover: elevenlabs.io". | Second Look. A ten-second second look, before you take it. Try it at get second look dot vercel dot app. |

## Shot list (Vedhanth records — about 20 minutes)
Setup: dark towel or the dark paper, bright light from the side, no flash, every pill lying flat (a tilted pill can be
flagged "looks different"), spread out so none touch. Use the printed made-up labels only — never a real prescription.
1. HANDS (phone camera, landscape): tape the Metformin label card onto an empty pill bottle; open it and pour the
   10 pills (9 × G 12 + the amoxicillin, "93" side up) onto the towel. 2–3 takes. → 0:00
2. iPHONE SCREEN RECORDING (Control Center → Screen Recording) on getsecondlook.vercel.app/check → "Check my pills":
   label photo → pills photo (phone ~8 in. above, pills fill most of the frame) → wait for red → scroll to pill 5.
   Then flip ONLY pill 5 where it is → "Flip and snap again" → wait for "Amoxicillin". → 0:34–1:20
   Each run costs about 6–10¢ of API credit. If a take doesn't come out red, retake (max 4 takes).
3. iPHONE SCREEN RECORDING: "Check one pill" → Advil Liqui-Gels label → one Kirkland softgel, "IB 200" up. → 1:20
4. Optional B-roll with a second phone: your hand flipping pill 5.
5. Laptop pages (home, /sources, /research, diagram) — the builder records these automatically.
6. Voiceover: paste the Voiceover column into ElevenLabs → voiceover.mp3 (or let the builder render the macOS voice).
Put everything in "DSH Hacks/video/raw/". The builder edits the final video (captions on, no music or very quiet).

## Claim check (planner, Nov 12 — verify again on the final cut)
- 51.5M dispensing errors (Flynn et al.) and 34% / 66% (Kesselheim et al., heart medicine) — cited in docs/DEVPOST.md.
- "About ten seconds": real 10-pill bottle check took 9.6 s live (phase 10b handoff). Don't say faster.
- "93" alone → MISMATCH, no medicine named; "93 / 2263" → Amoxicillin 500 mg (phase 10b real follow-up, 11b wording).
- "Reads again if not sure": bottle double-read for 0.5–0.69 confidence (phase 11). "Can't tell instead of guessing": UNSURE.
- "Only green when it has read every pill": solid green requires every pill imprint-confirmed; "Looks right" is a
  separate soft state — don't call that "green" in the VO.
- "Never saves your photos": shares store positions/readings only (phases 9–10c).
- 150 NIH photos / 83 of 88: historical first-version (pill-v2) frozen test on /research — hence "first version".
- If the live take shows pill 10 (or any metformin) with "!" or "?", that's fine on screen; don't say "nine matched"
  unless nine show ✓ — change the line to "The others say G 12."

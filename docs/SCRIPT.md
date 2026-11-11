# Demo video — Second Look (target 2:30, max 3:00)

Voiceover: AI voice (DSH allows AI). Best: ElevenLabs on a parent's account (free plan is fine for this
non-commercial video, but the video and Devpost MUST credit "Voiceover: elevenlabs.io"). Fallback with no account:
a macOS Premium voice (e.g. Ava or Zoe Premium) rendered by the builder with `say`.
Calm, warm, unhurried voice. ~330 words. [BRACKETS] = fill in after the real bottles are photographed.

| Time | On screen | Voiceover |
|---|---|---|
| 0:00–0:12 | Close-up: hands open a pharmacy bottle, pour pills into a palm. Text: "Is this the right pill?" | Imagine opening your refill and the pills look different. Same label. Different pill. Is it a mistake, or just a new maker? Most people have no way to know. |
| 0:12–0:27 | Big numbers, one at a time: "51.5 million dispensing errors a year" (Flynn 2003) → "34% / 66% higher odds of stopping after a color / shape change" (Kesselheim 2014). Small citation text. | US pharmacies make an estimated fifty-one and a half million dispensing errors a year. And when a refill looks different, people are more likely to stop taking it: thirty-four percent higher odds after a color change, sixty-six percent after a shape change. |
| 0:27–0:37 | Home page on phone. Logo + "Is this the right pill?" | This is Second Look. Take a photo of the pharmacy label and one pill, and in about ten seconds it tells you whether that pill is the medicine on your label, and shows you the proof. |
| 0:37–1:07 | PHONE: wrong-pill bottle. Snap label → snap pill → checking steps tick → red "Doesn't match" → FDA drawing vs photo → "This imprint belongs to acetaminophen" → pharmacist script. | This bottle says ibuprofen, two hundred milligrams. Here's a pill from inside. Claude reads the label and the letters stamped on the pill. Then Second Look checks every FDA record for ibuprofen two hundred milligrams, [507] versions from every maker, and none of them say [L484]. That imprint belongs to acetaminophen. So it tells you clearly: don't take it, call your pharmacy, and here's what to say. |
| 1:07–1:27 | PHONE: "Advil" bottle with store-brand pills → green "Same medicine" → "Made by [maker]" card. | This one says Advil, but the pills look nothing like Advil. Second Look finds the FDA record for this exact pill: same medicine, same strength, made by a different company. Pharmacies switch makers all the time, and knowing that helps people keep taking their medicine. |
| 1:27–1:37 | PHONE: right-pill bottle → green "Matches" + FDA source badge. Quick. | And when it's right, it says so, with the FDA record to prove it. |
| 1:37–2:02 | Diagram: Label photo → Pill photo → AI reads → FDA records → Code decides. Then /sources page. | Here's the key idea: AI reads, code decides. The AI only reads what's printed. Plain code compares the imprint, color and shape against real FDA DailyMed and National Library of Medicine records, and picks the answer. If the AI's explanation mentions anything the code didn't find, we throw it out. And if the photo isn't clear, it says "can't tell" instead of guessing. |
| 2:02–2:25 | /research page: the comparison table, then the "found and fixed a safety bug" note. | We tested it on a hundred and fifty real NIH pill photos it had never seen. When it gave an answer, it was right eighty-three out of eighty-eight times, and it made fewer than half as many false alarms as asking the AI directly. The test also caught a real safety bug. We fixed it, and published the before and after. |
| 2:25–2:38 | Home page + URL + QR. Small text: "Not medical advice. Always check with your pharmacist." End card credit: "Voiceover: elevenlabs.io". | Second Look. A ten-second second look, before you take it. Try it at get second look dot vercel dot app. |

## Shot list (what Vedhanth records)
1. iPhone SCREEN RECORDINGS (Control Center → Screen Recording) of the 3 real checks on getsecondlook.vercel.app/check:
   wrong pill, same medicine, right pill. Hold steady, good light, one pill letters-up on a plain surface.
2. HAND SHOTS (phone camera, landscape, 4K or 1080p): opening the bottle and pouring pills (0:00); snapping the label
   and the pill with the other phone/hand (optional B-roll for 0:37 and 1:07).
3. Everything on the laptop (home, diagram, sources, research) the builder can record automatically.
4. Voiceover file: voiceover.mp3 (ElevenLabs) — or let the builder render the macOS fallback.
Put all files in "DSH Hacks V2/video/raw/". The builder edits the final video (captions on, music very quiet or none).

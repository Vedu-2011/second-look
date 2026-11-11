# Phase 10c — merge phases 9–10b, then one small display fix
Builder: whichever has usage (Claude Code preferred). Folder is now ~/Hackathons/DSH Hacks (renamed from
"DSH Hacks V2" — nothing else changed; .vercel, git remote and node_modules are inside it). Read BOARD + newest
handoff (Codex phase 10b) first. Add your BOARD row.

## 1. Merge — Vedhanth reviewed the preview and says "merge"
- Commit the untracked planner prompts (prompts/phase-10b.md, phase-10b-codex.md, review-phase-9-10.md, phase-10c.md).
- Take MAIN LOCK. Merge feat/phase-9-bottle into main (no squash needed), tests + build pass, push main.
- Check production https://getsecondlook.vercel.app deploys Ready: /check opens on "Check my pills", /labels shows the
  metformin/Advil labels, /samples loads, one free typed check (/type) works, both saved real bottle shares open.
  No paid calls. Release MAIN LOCK.

## 2. Display fix (new branch feat/phase-10c-polish, preview only, do NOT merge)
After "flip and snap again", pills that MATCHED in the first photo show as gray "?" + "Earlier photo only. Position
cannot confirm the pill in this photo; a new green result requires reading it again." Safe, but on video it looks like
the app is unsure about 9 pills. Change the DISPLAY only — safety logic stays exactly as Codex left it (carried
results never count as current confirmation and can never make the bottle green):
- A pill that was MATCH (or same-medicine) in the first photo and wasn't re-read: soft green outline marker with a
  small check (not the solid green of a current match), status "Matched in your first photo", one line:
  "We didn't read it again." Legend gets "Matched earlier".
- A pill that was UNSURE first time stays "?" as now. Re-read pills show their new result as now.
- Result box line stays honest, plainer: "We read pill 5 again. The other 9 are from your first photo."
Tests for the display mapping (carried MATCH → "matched earlier", carried UNSURE → "?"), screenshots of the after-flip
result at 375 / 1440 / 1920 (use the saved real results, no paid calls). Push to a preview.

Handoff to ~/Hackathons/_coord/handoffs/, BOARD row out, run tidy.sh.

## 3. Make the result easy to read (same branch, display only) — Vedhanth: "so much random stuff"
Look at the saved real BEFORE share (/result/63a1a5cd-0ffe-440b-839c-3e89470697e3) at 375 and fix:
- BUG: the orange "flip this one" ring is drawn between pills 4 and 7, not around pill 5. Ring must sit on its pill
  (check the coordinate mapping for rings vs number badges on both the live result and the share page).
- Lead with only what matters: big verdict card, then ONE line summary ("8 match · 1 doesn't match · 1 can't tell"),
  then the pills that need attention (red, "!", "?") as rows. Matched pills collapse into one row
  "8 pills match your label" that expands to the list.
- Legend: show only the symbols that actually appear in this result.
- Share page (no photo, by design): one short line above the dots — "Each dot is a pill, in the spot it was in your
  photo. We never save photos." Remove the separate gray box and the "Is every pill numbered?" heading on the share
  page (keep that check on the live result right after taking the photo, where it makes sense).
- Pill 10 is a real metformin "G 12" flagged "! looks different". Don't change thresholds; just report in the handoff
  which feature tripped (size/shape/color) so the planner can decide.
Screenshots of before + after shares and the live result at 375 / 1440 / 1920.

# CLAUDE.md — DSH Hacks V2 (project name TBD)

The rules in ~/Hackathons/CLAUDE.md apply here too. This file adds what's specific to this event.

## The event
- Link: https://dsh-hacks-v2.devpost.com (organizers: DeltaForge Hacks, NXT Horizon, STEMise). Online. ~1,086 registered.
- Deadline: Sat Nov 14, 2026, 11:45 PM PST. Our target: submitted by Sat Nov 14, noon PST.
  (The rules page says Nov 8 but the Devpost banner says Nov 14 — banner is current.)
- Judging Nov 15–22 (remote, from the video + Devpost page), winners Nov 23. No live pitch — the VIDEO is the pitch.
- Theme: AI x Healthcare. Students 13+. Solo or team. AI use is allowed and encouraged.
- Judging criteria: Idea (fits theme, innovative, public impact) · Implementation (works, goals met,
  technically challenging) · Design (UX + interface quality) · Presentation (clearly defines and solves the problem).
- Submission needs: working website/app with user interaction · demo video (purpose, features, user
  interaction) · ONE-PAGE project description PDF · public GitHub repo with all code · Devpost write-up.
- Prizes: 1st–3rd = credits bundles (Momen $2,000, Adaption Labs $1,000, CodeCrafters, CleanShot, AoPS);
  Best Research-Oriented Project (YRI 50% research fellowship scholarship).
- Health safety: never present output as a diagnosis. Show a short "not medical advice" line where
  it matters. Use only made-up patients and documents in seed data.

## Design
- docs/DESIGN.md is the design source of truth. Read it before ANY UI work, follow it exactly, and screenshot
  375px + 1440px after every UI change. Beautiful UI is a hard requirement, not polish for later.

## The project
- See docs/ARCHITECTURE.md (written by the planner once the idea is locked).

## Files
- prompts/phase-N.md — written by the planner. Do one when Vedhanth says "Do prompts/phase-N.md".
- HANDOFF.md — add your handoff entry at the TOP after every task.
- docs/ — ARCHITECTURE.md, IDEAS.md, PITCH.md, DEVPOST.md, SCRIPT.md

## Show that it matters and that the data is REAL (Vedhanth's rule for everything we submit)
Every deliverable (app, Devpost, video, 1-page PDF, README) must make two things obvious:
1. Why this matters — real, cited numbers: ~51.5M US pharmacy dispensing errors a year (Flynn et al., J Am
   Pharm Assoc 2003); pill color change → 34% higher odds of stopping heart meds, shape change → 66%
   (Kesselheim et al., Annals of Internal Medicine 2014). Say "addressable", never "prevented".
2. That we use real data, not mock data:
   - Every verdict card shows its source: "FDA DailyMed label <setid>, published <date>" with a link, plus
     RxNorm for same-drug/other-manufacturer matches. Show the actual FDA fields (imprint, color, shape, size).
   - A visible "Data sources" page/section: FDA DailyMed, NLM RxNorm, NIH Pill Image Recognition dataset — what
     each is, what we use it for, and a live "last checked" date.
   - The research result comes from a real NIH benchmark, with the exact number of images tested.
   - Be honest about what's demo-only: the patient name on the label is made up; the pills and FDA data are real.
Never invent a statistic or a source. If a number isn't from a cited source or our own test, it doesn't go in.

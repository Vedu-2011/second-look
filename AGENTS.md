# AGENTS.md — Second Look (DSH Hacks V2) — READ THIS FIRST, Codex

Vedhanth switches between Claude Code and Codex as the builder, depending on which has usage left. Claude Code
built phases 0–1. Nothing lives in chat memory — the files are the memory, so you can pick up exactly where the
last builder stopped.

## Before ANY task, read these fully, in order (they are your rules, word for word)
1. /Users/mellamputi_vedhanth/Hackathons/CLAUDE.md — rules for every hackathon: how we work, the 10 build rules,
   "Switching builders (Claude Code ⇄ Codex)", the HANDOFF format, default stack, playbook.
2. ./CLAUDE.md — this event: DSH Hacks V2 facts and deadline, Design rule, "show it's REAL data" rule.
3. docs/ARCHITECTURE.md (incl. every "Decisions after…" section), docs/DESIGN.md, docs/TIMELINE.md.
4. The NEWEST entry at the top of HANDOFF.md, then run `git status` and `git log --oneline -5`.
   If there are uncommitted changes you didn't make, the other builder stopped mid-task: read its PARTIAL handoff,
   keep its work, continue. Never reset or discard it.
Wherever those files say "Claude Code" or "you", that means YOU. They apply exactly the same.

## Who does what
- Vedhanth = architect + presenter. He only does what truly needs a human (logins, CAPTCHAs, terms, his phone).
- The planner = a separate Claude chat (the "Hackathons" claude.ai project). It writes prompts/phase-N.md straight
  into this folder and reads HANDOFF.md itself. You never talk to it directly — HANDOFF.md is how you talk to it.
- You = the builder. You write all code, run all checks, deploy.

## The loop
- Vedhanth types `Do prompts/phase-N.md` → do exactly that one phase. Plan in 3–5 bullets first.
- Or `Continue prompts/phase-N.md — read the PARTIAL handoff first` → finish what the last builder left.
- When done: add a HANDOFF entry at the TOP of HANDOFF.md (format in ~/Hackathons/CLAUDE.md; first line after the
  heading must be `BUILDER: Codex`; newest first; never delete old entries), commit it with the phase, push, and
  say in chat: "Handoff saved to HANDOFF.md — tell the planner: handoffs".
- If you're about to run out of usage or he says "stop and hand off": stop at a safe point, commit "WIP: …",
  write a STATUS: PARTIAL handoff listing done / left (task numbers) / half-finished files / next command.
- "Codex review before every push": since you are Codex, do a separate careful review pass of your own diff
  (or use Codex's review command), fix every real finding, list them in the handoff.

## Already set up (don't redo)
- GitHub Vedu-2011/second-look (public), branch main. Vercel project vedhanth/second-look is git-connected:
  every push to main auto-deploys https://getsecondlook.vercel.app
- Upstash Redis via KV_* env vars — shared DB, so ALL our keys go through key() in src/lib/redis.ts ("sl:" prefix).
- Tests: vitest (108 passing after phase 1), eslint, tsc, next build — all must stay green.
- Secrets only in .env.local and Vercel env. Never commit them, never write them into HANDOFF.md.
- You need network (npm, gh, vercel, RxNav/DailyMed, Anthropic API). If the sandbox blocks a command, ask Vedhanth
  to approve it — don't silently skip it.
- Screenshots: headless Chrome or Playwright from the shell is fine (375 + 1440, docs/screenshots/phase-N/).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — READ THIS FIRST, Codex
You are one of TWO builders (Codex + Claude Code) and the other may be working at the same time. Files are the memory.
Before ANY task, read fully, in order:
1. /Users/mellamputi_vedhanth/Hackathons/CLAUDE.md  (all rules; esp. "Two builders" + "Handoff")
2. /Users/mellamputi_vedhanth/Hackathons/_coord/BOARD.md + newest files in _coord/handoffs/
3. ./CLAUDE.md (this event's rules), then everything in docs/
4. `git status` + `git log --oneline -5`
Where those files say "Claude Code" generically, that means you.
If Claude Code is active in this hackathon, don't touch its folder — make your lane:
  bash ~/Hackathons/_coord/new-lane.sh "<this folder's name>" codex <branch>
Loop: Vedhanth types `Do prompts/<file>.md` (or `Continue …`). Add your BOARD row, do exactly that, commit, push,
write your handoff file to ~/Hackathons/_coord/handoffs/ (BUILDER: Codex), move your BOARD row to Done, and say:
"Handoff saved — tell the planner: handoffs".

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

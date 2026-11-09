# HANDOFF log — newest entry on top
Claude Code adds a new entry at the top after every task (format in ~/Hackathons/CLAUDE.md).
The planner reads this file when Vedhanth says "handoffs". Never delete old entries.

## 2026-11-08 11:35 PM PST — Phase 0: skeleton, design system, live deploy — prompts/phase-0.md

HANDOFF — Phase 0 (skeleton, design system, drawn pill, pages, deploy) — Sun Nov 8, 2026, 11:35 PM PST
STATUS: DONE (one small thing needs Vedhanth: let Vercel see the new GitHub repo, see below)

LINKS
- Production: https://getsecondlook.vercel.app (public, no login). /api/health → {"ok":true,"redis":true,...}
  (second-look.vercel.app was taken; Vercel's auto alias second-look-tawny.vercel.app also works)
- Repo (public): https://github.com/Vedu-2011/second-look — branch main
- Vercel project: vedhanth/second-look. Preview test deploy (opens with no login):
  https://second-look-ox9r0dymy-vedhanth.vercel.app

WHAT I DID
- Scaffolded Next.js 16.4.5 (App Router, TS, Tailwind v4, src/) in a temp folder and moved it in; kept CLAUDE.md,
  HANDOFF.md, docs/, prompts/. Added vitest 5, shadcn/ui (base-nova) restyled to DESIGN.md, lucide icons, @upstash/redis.
  Note: create-next-app 16 turns on `cacheComponents` by default, so routes use `await connection()` instead of
  `export const dynamic` (the old config is a build error now).
- Design system: Atkinson Hyperlegible Next + Mono via next/font/google; all 7 DESIGN.md colors as CSS vars wired
  into Tailwind (bg-amber, text-ink, bg-match…); body 18px mobile / 20px desktop; radius hierarchy (photo/verdict 20,
  rows 12, buttons full); soft shadows, no hairline borders; visible 3px ink focus ring; reduced motion respected.
- src/lib/fda/codes.ts: all 12 FDA colors (C48323–C48334) and 19 shapes (C48335–C48353), verified against
  fda.gov SPL Color / SPL Shape pages (URLs in the file), plus our display hex per color.
- src/lib/fda/fixtures.ts: real records pulled live from RxNav + DailyMed today (I2 round, I2 oval, Advil oval,
  L484 acetaminophen, a two-tone omeprazole capsule for the capsule drawing), each with NDC, setid, published date,
  source URL.
- Components (src/components/): Button (+ButtonLink), StepIndicator, VerdictField (4 verdicts), FeatureTable,
  CheckingSteps (waiting/working/done/failed), SourceBadge, PillDrawing, site header/footer. Verdict wording lives
  in src/lib/verdict.ts (types phase 1 can reuse).
- PillDrawing: SVG built in millimetres from shape code + color codes + size, so pills sit side by side to scale.
  Round, oval, capsule, rectangle, square, diamond, triangle, 5–8-sided polygons; other shapes (bullet, tear,
  clover…) fall back to round and say so. Two-tone = split halves. Tablets get a debossed imprint, capsules a
  printed one. Highlight modes imprint/color/shape. Optional mm ruler. Pure math in src/lib/pill.ts.
- Pages: / (Flynn stat with PubMed link + a real drawn FDA pill card + Kesselheim line with PubMed link),
  /check (2-step label → pill capture, camera + upload, preview, retake, friendly non-image error, fake 4-step
  checking that ends with an honest "preview" note), /samples (3 cards: match / same medicine / mismatch with real
  FDA drawings, photo placeholders), /sources (DailyMed, RxNorm, NIH dataset — what/why/links, last checked),
  /style (every component, all 4 verdicts, 3 real pills to scale, highlights, every FDA shape, colors, type).
  Footer disclaimer on every page.
- /api/health writes a per-request Redis key, reads it back, deletes it.
- Vercel: linked, deployed to production, preview deployment protection turned OFF (ssoProtection = null, tested
  with a real preview URL → 200 without login).

FILES CREATED/CHANGED
src/app/{layout,page,globals.css}, src/app/{check/{page,check-flow},samples/page,sources/page,style/page}.tsx,
src/app/api/health/{route,route.test}.ts, src/components/{button,checking-steps,feature-table,pill-drawing,
site-chrome,source-badge,step-indicator,verdict-field}.tsx, src/components/ui/button.tsx,
src/lib/{pill,pill.test,redis,verdict}.ts, src/lib/fda/{codes,codes.test,fixtures}.ts, vitest.config.mts,
.env.example, .gitignore (allows .env.example), docs/screenshots/phase-0/*.png (16 files)

TESTS RUN
- vitest: 31/31 PASS (codes lookups + packed two-tone codes, pill geometry/fills/imprint/size helpers incl. every
  FDA shape, /api/health with Redis mocked: ok, not configured, wrong value, Redis down, two overlapping probes).
- eslint PASS, tsc PASS, next build PASS.
- Codex review of the phase commit: 2 findings, both real, both fixed (shared health key could false-fail under
  concurrent probes → per-request key; Advil 16 mm fixture is brown on one side/yellow on the other → switched,
  see decisions). I did not re-run Codex on the small fix commit.
- How-to-test checklist, run by me against PRODUCTION with headless Chrome at 375px:
  1. Home at 375 looks finished, Flynn link opens PubMed — PASS
  2. /check: upload → preview → step 2 (focus moves to new heading) → non-image file shows friendly error →
     pill photo → "Check my pill" → steps tick done,working… → all 4 done → "Check finished", 2 thumbnails — PASS
  3. /style: 4 verdicts readable; I2 round 10 mm, I2 oval 15 mm, Advil oval 15 mm drawn to the same scale — PASS
  4. /api/health → {"ok":true,"redis":true} on production, preview and local — PASS
  5. Keyboard: every control shows a 3px focus outline; reduced motion: spinner has no animation, steps still
     tick to done — PASS
- Screenshots 375 + 1440 of /, /check, /samples, /sources, /style + 3 check-flow states in
  docs/screenshots/phase-0/. No horizontal overflow on any page at either width.

PROBLEMS / DECISIONS I MADE
- Redis: a new Upstash database was refused (`no_eligible_plan`: the free plan is used by LineLess's database,
  only paid plans were offered). I did NOT buy one. I connected the existing LineLess Upstash database
  (upstash-kv-crimson-diamond) to this project instead — same KV_ env names — and every Second Look key goes
  through key() in src/lib/redis.ts with the prefix "sl:", so nothing collides with LineLess. If you'd rather have
  a separate database, Vedhanth has to pick a paid plan (or delete the old one) in the Vercel dashboard.
- GitHub → Vercel auto-deploy is NOT connected yet: `vercel git connect` failed because the Vercel GitHub app
  can't see the new repo (it's probably set to "selected repositories"). Production was deployed with the CLI.
- Advil: the 16 mm Advil oval (NDC 0573-0165) is "brown (one side is brown while the other side is yellow)" per
  the FDA record, so a solid brown drawing would be wrong. I used NDC 0573-0160 instead: same DailyMed label
  (setid 1a665e64…, published Nov 6, 2026), plain pinkish-brown oval, 15 mm, imprint "Advil".
- I2 round (NDC 0113-0074) is discontinued: RxNav marketing status COMPLETED, last DailyMed version Feb 24, 2025,
  and it's gone from the current DailyMed list (the drugInfo link still opens). Fine for /style; don't build a
  demo bottle on it. The I2 oval (0113-0517) is active.
- pir.nlm.nih.gov (the NIH challenge link in ARCHITECTURE.md) no longer resolves. The dataset is at
  https://data.lhncbc.nlm.nih.gov/public/Pills/index.html and the paper is Yaniv et al. 2016 (PubMed 29854569).
  /sources uses those.
- Data facts phase 1 needs: RxNav packs two-tone colors in ONE value ("C48325;C48331") — splitCodes() handles it.
  SCORE "1" means NOT scored (it's the number of pieces). Imprints can carry notes ("Advil;asymmetrical;underline",
  "082;IMPAX;20").
- Contrast: white on --match is 4.35:1 (passes only as large text), so all verdict text is bold and ≥ 20px.
  Primary buttons use ink text on amber (6.4:1); white on amber would fail.
- /check ends with "This is a preview of the checking screen. Real results are coming in the next version." and a
  link to /samples, so nobody mistakes the fake run for a result.
- Kesselheim numbers checked against the PubMed abstract: color aOR 1.34 (1.12–1.59), shape aOR 1.66 (1.43–1.94).

CURRENT STATE OF THE APP
Live, public, design-complete skeleton. No Anthropic calls. /check is UI only (fake timers). /samples shows real
FDA drawings with photo placeholders. Redis works in production.

NEEDS VEDHANTH
1. GitHub → Settings → Applications → Vercel → Configure → add the repo "second-look" (or "All repositories").
   Then tell me and I'll run `vercel git connect` so every push to main auto-deploys. (Until then I deploy by CLI.)
2. Optional: decide whether sharing the LineLess Redis is OK (it's free; a separate one costs money).

OPEN QUESTIONS FOR THE PLANNER
- Demo bottle 2 says "label with Advil's NDC": which Advil NDC will you print? 0573-0160 (plain brown 15 mm oval)
  is the clean one; 0573-0165 is two-colored.
- Want two-sided pills drawn (front + back, e.g. Advil brown/yellow faces) in phase 3, or is "Other side: …" text
  under the drawing enough?

SUGGESTED NEXT STEP
Phase 1 (FDA data layer + matcher + verdict engine). codes.ts, fixtures.ts, verdict.ts and the "sl:" Redis key
helper are ready to build on.


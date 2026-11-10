import { readFile, writeFile, mkdir } from "node:fs/promises";
import { writeFileSync, renameSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import sharp from "sharp";
import type Anthropic from "@anthropic-ai/sdk";
import { readPill } from "../src/lib/ai/readers";
import { getAnthropic, setAiUsageObserver } from "../src/lib/ai/client";
import {
  readPillPrompt,
  readPillTool,
  READ_PILL_PROMPT_VERSION,
} from "../src/lib/ai/prompts/read-pill";
import { lookupNdc, drugGroup } from "../src/lib/fda/rxnav";
import { decide, type PillReading } from "../src/lib/verdict-engine";
import {
  buildPairs,
  shuffled,
  percent,
  type ResearchImage,
  type Observation,
} from "../src/lib/research";
import { safetyMetrics } from "../src/lib/research-safety";
import { compareImprint } from "../src/lib/match/imprint";
import { requestCostBound } from "../src/lib/research-budget";
import {
  loadHoldout,
  holdoutHeadline,
} from "../src/lib/research-holdout-results";
import type { Product } from "../src/lib/fda/types";
const seed = 20261110,
  model = "claude-sonnet-5-5",
  base = "https://data.lhncbc.nlm.nih.gov/public/Pills/";
type Cohort = {
  seed: number;
  images: (ResearchImage & { sha256: string })[];
  products: Record<
    string,
    { product: Product; generic: string; products: Product[] }
  >;
  skipped: { ndc: string; reason: string }[];
};
type Reading = { reading: PillReading; ms: number; error?: string };
const read = async <T>(path: string, fallback: T): Promise<T> => {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw e;
  }
};
function save(path: string, value: unknown) {
  writeFileSync(path + ".tmp", JSON.stringify(value, null, 2) + "\n");
  renameSync(path + ".tmp", path);
}
const hash = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
async function parallel<T>(items: T[], work: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < items.length) await work(items[next++]);
    }),
  );
}
const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();
async function prepare(dev: Cohort): Promise<Cohort> {
  const previous = await read<Cohort | null>(
    "research/out/holdout-cohort.json",
    null,
  );
  if (previous) return previous;
  const index = await readFile(
    "research/data/directory_consumer_grade_images.txt",
    "utf8",
  ).catch(async () => {
    const r = await fetch(base + "directory_consumer_grade_images.txt");
    if (!r.ok) throw Error("NIH index unavailable");
    return r.text();
  });
  const entries = new Map<string, { path: string; part: string }[]>();
  for (const line of index.split(/\r?\n/)) {
    const [ndc, part, path, type] = line.split("|");
    if (type === "C3PI_Test" && path?.toLowerCase().endsWith(".jpg"))
      entries.set(ndc, [...(entries.get(ndc) ?? []), { path, part }]);
  }
  const excluded = new Set(dev.images.map((i) => i.product.productCode));
  const seen = new Set<string>();
  const eligible: {
    ndc: string;
    product: Product;
    group: NonNullable<Awaited<ReturnType<typeof drugGroup>>>;
    photos: { path: string; part: string }[];
  }[] = [];
  const cohort: Cohort = { seed, images: [], products: {}, skipped: [] };
  const ndcs = shuffled(
    [...entries.keys()].filter((ndc) => !excluded.has(ndc.slice(0, 9))),
    seed,
  );
  for (
    let offset = 0;
    offset < ndcs.length && eligible.length < 100;
    offset += 6
  ) {
    const batch = await Promise.all(
      ndcs.slice(offset, offset + 6).map(async (ndc) => {
        try {
          const product = (await lookupNdc(ndc)).product;
          if (!product?.imprintRaw.trim())
            throw Error("No FDA imprint/product");
          if (excluded.has(product.productCode))
            throw Error("Development product alias");
          const group = await drugGroup(product.rxcui);
          if (!group) throw Error("No drug group");
          const list = entries.get(ndc)!;
          if (new Set(list.map((i) => i.part)).size !== 1)
            throw Error("Multipart product");
          const photos = shuffled(list, seed + Number(ndc.slice(-5))).slice(
            0,
            2,
          );
          if (photos.length !== 2) throw Error("Fewer than two views");
          return { ndc, product, group, photos };
        } catch (e) {
          return {
            ndc,
            error: e instanceof Error ? e.message : "Lookup failed",
          };
        }
      }),
    );
    for (const e of batch) {
      if (eligible.length === 100) break;
      if ("error" in e) {
        cohort.skipped.push({ ndc: e.ndc, reason: e.error! });
        continue;
      }
      if (seen.has(e.product.productCode)) continue;
      seen.add(e.product.productCode);
      eligible.push(e);
    }
    console.log(
      "Holdout metadata pool: " + eligible.length + "/100; no model calls",
    );
  }
  const hard = (a: (typeof eligible)[number], b: (typeof eligible)[number]) =>
    a.group.generic.rxcui !== b.group.generic.rxcui &&
    a.product.productCode !== b.product.productCode &&
    !!a.product.shapeCode &&
    a.product.shapeCode === b.product.shapeCode &&
    a.product.colorCodes.length > 0 &&
    [...a.product.colorCodes].sort().join() ===
      [...b.product.colorCodes].sort().join() &&
    compareImprint(a.product.imprintRaw, b.product.imprintRaw).result !==
      "exact" &&
    compareImprint(b.product.imprintRaw, a.product.imprintRaw).result !==
      "exact";
  const selected: typeof eligible = [];
  for (const e of eligible) {
    if (selected.length >= 60) break;
    if (selected.includes(e)) continue;
    const mate = eligible.find((b) => !selected.includes(b) && hard(e, b));
    if (mate) selected.push(e, mate);
  }
  if (selected.length < 60)
    throw Error("Insufficient hard-partner strata; no model calls allowed");
  for (const e of eligible) {
    if (selected.length === 75) break;
    if (!selected.includes(e)) selected.push(e);
  }
  if (selected.length !== 75) throw Error("Insufficient metadata pool");
  for (const entry of selected) {
    for (const [side, photo] of entry.photos.entries()) {
      const url =
        base + photo.path.split("/").map(encodeURIComponent).join("/");
      const file = "research/data/holdout-" + entry.ndc + "-" + side + ".jpg";
      const bytes = await readFile(file).catch(async () => {
        const response = await fetch(url);
        if (!response.ok) throw Error("Photo unavailable " + url);
        const output = await sharp(Buffer.from(await response.arrayBuffer()))
          .rotate()
          .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toBuffer();
        await writeFile(file, output);
        return output;
      });
      cohort.images.push({
        file,
        url,
        ndc: entry.ndc,
        product: entry.product,
        generic: entry.group.generic.rxcui,
        sha256: hash(bytes),
      });
    }
    cohort.products[entry.ndc] = {
      product: entry.product,
      generic: entry.group.generic.rxcui,
      products: entry.group.products,
    };
  }
  const pairs = buildPairs(cohort.images, seed);
  if (pairs.filter((p) => p.difficulty === "hard").length < 120)
    throw Error(
      "Metadata cohort fails predeclared 80% hard requirement; no AI run permitted",
    );
  save("research/out/holdout-cohort.json", cohort);
  await writeFile(
    "research/HOLDOUT-DATA.md",
    `# Holdout sources\n\nSeed ${seed}. Look-alike-stratified selection from the first 100 seeded eligible, product-disjoint codes: 60 codes selected in mutual hard-negative pairs, then 15 additional seeded codes. Two single-part consumer views per code. Selection completed before any model output. All 100 development product codes are excluded, including package aliases.\n\n${cohort.images.map((i) => `- ${i.file} | NDC ${i.ndc} | SHA256 ${i.sha256} | ${i.url}`).join("\n")}\n\n## Skips (${cohort.skipped.length})\n${cohort.skipped.map((s) => `- ${s.ndc}: ${s.reason}`).join("\n")}\n`,
  );
  return cohort;
}
type Row = Observation & {
  reading?: PillReading | PillReading[];
  raw?: string;
};
function evaluate(
  cohort: Cohort,
  cache: Record<string, Reading>,
  version: string,
) {
  const pairs = buildPairs(cohort.images, cohort.seed),
    one: Row[] = [],
    two: Row[] = [];
  for (const pair of pairs) {
    const image = cohort.images.find((i) => i.file === pair.image)!;
    const mate = cohort.images.find(
      (i) => i.ndc === image.ndc && i.file !== image.file,
    )!;
    const first = cache[`${version}:${image.sha256}`]?.reading,
      second = cache[`${version}:${mate.sha256}`]?.reading;
    if (!first || !second) throw Error("Missing cached reading");
    const expected = cohort.products[pair.labelNdc],
      data = {
        labelProduct: expected.product,
        sameDrugProducts: expected.products,
      };
    one.push({
      ...pair,
      reading: first,
      verdict: decide({ ndc: pair.labelNdc }, first, data).verdict,
    });
    two.push({
      ...pair,
      reading: [first, second],
      verdict: decide({ ndc: pair.labelNdc }, [first, second], data).verdict,
    });
  }
  return { "Sonnet, one view": one, "Sonnet, two views": two };
}
async function main() {
  await mkdir("research/data", { recursive: true });
  const dev = (await read<Cohort | null>("research/out/cohort.json", null))!;
  if (!dev) throw Error("Missing development cohort");
  if (process.argv.includes("--dev")) {
    const cache = await read<Record<string, Reading>>(
      "research/out/readings-claude-sonnet-5-5.json",
      {},
    );
    const rows: Record<string, Row[]> = evaluate(dev, cache, "pill-v1");
    const direct = await read<
      Record<string, { verdict: Observation["verdict"] }>
    >("research/out/baseline.json", {});
    rows["Direct Sonnet"] = buildPairs(dev.images, dev.seed).map((pair) => {
      const image = dev.images.find((i) => i.file === pair.image)!;
      const b = direct[`${image.sha256}:${pair.labelNdc}:baseline-v2`];
      if (!b) throw Error("Missing development direct cache");
      return { ...pair, verdict: b.verdict };
    });
    save("research/out/development-results.json", {
      images: 200,
      pairs: 400,
      readingVersion: "pill-v1",
      metrics: Object.fromEntries(
        Object.entries(rows).map(([k, v]) => [k, safetyMetrics(v)]),
      ),
    });
    console.log("Development-only cached metrics saved; no new readings.");
    return;
  }
  const cohort = await prepare(dev);
  if (process.argv.includes("--prepare")) return;
  const codeFiles = git(
    "ls-files",
    "src",
    "scripts",
    "package.json",
    "package-lock.json",
  )
    .split("\n")
    .filter(Boolean);
  const hashes = Object.fromEntries(
    await Promise.all(codeFiles.map(async (p) => [p, hash(await readFile(p))])),
  );
  if (process.argv.includes("--freeze")) {
    if (
      git(
        "status",
        "--porcelain",
        "--",
        "src",
        "scripts",
        "package.json",
        "package-lock.json",
      )
    )
      throw Error("Commit implementation before freezing");
    if (await read("research/out/holdout-freeze.json", null))
      throw Error("An existing freeze cannot be silently replaced");
    save("research/out/holdout-freeze.json", {
      commit: git("rev-parse", "HEAD"),
      hashes,
      cohortHash: hash(JSON.stringify(cohort)),
      date: new Date().toISOString(),
      seed,
      protocol:
        "150 photos / 300 balanced pairs; >=80% hard; first-side headline; v2 one/two views + direct Sonnet; $5 new spend; no dev v2 rereads",
    });
    console.log("Frozen", git("rev-parse", "HEAD"));
    return;
  }
  const freeze = await read<{
    commit: string;
    hashes: Record<string, string>;
    cohortHash: string;
  } | null>("research/out/holdout-freeze.json", null);
  if (
    !freeze ||
    freeze.cohortHash !== hash(JSON.stringify(cohort)) ||
    Object.entries(freeze.hashes).some(([p, h]) => hashes[p] !== h) ||
    Object.keys(hashes).length !== Object.keys(freeze.hashes).length
  )
    throw Error(
      "Missing freeze or implementation/cohort changed since freeze. Do not tune after holdout.",
    );
  const forbidden = new Set(dev.images.map((i) => i.product.productCode));
  if (cohort.images.some((i) => forbidden.has(i.product.productCode)))
    throw Error("Development/holdout product leakage");
  const previousHashes = new Set(dev.images.map((i) => i.sha256)),
    previousURLs = new Set(dev.images.map((i) => i.url));
  if (
    cohort.images.some(
      (i) => previousHashes.has(i.sha256) || previousURLs.has(i.url),
    )
  )
    throw Error("Development/holdout photo leakage");
  const ledger = await read<
    { phase: string; input: number; output: number; usd: number }[]
  >("research/out/holdout-cost.json", []);
  let phase = "read",
    reserved = 0;
  const spent = () => ledger.reduce((sum, r) => sum + r.usd, 0);
  setAiUsageObserver((_model, input, output) => {
    ledger.push({ phase, input, output, usd: (input * 2 + output * 10) / 1e6 });
    save("research/out/holdout-cost.json", ledger);
    console.log(`New spend $${spent().toFixed(4)} / $5`);
  });
  const budget = async <T>(bound: number, work: () => Promise<T>) => {
    if (spent() + reserved + bound > 5)
      throw Error("$5 bound reached; all caches retained");
    reserved += bound;
    try {
      return await work();
    } finally {
      reserved -= bound;
    }
  };
  const cache = await read<Record<string, Reading>>(
    "research/out/holdout-readings.json",
    {},
  );
  process.env.VISION_MODEL = model;
  await parallel(cohort.images, async (image) => {
    const key = `${READ_PILL_PROMPT_VERSION}:${image.sha256}`;
    if (cache[key]) return;
    if (!process.argv.includes("--run"))
      throw Error(
        "Missing cache. Explicit --run required to spend after freeze.",
      );
    const bytes = await readFile(image.file).catch(async () => {
      const r = await fetch(image.url);
      if (!r.ok) throw Error("NIH photo unavailable");
      const output = await sharp(Buffer.from(await r.arrayBuffer()))
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();
      await writeFile(image.file, output);
      return output;
    });
    if (hash(bytes) !== image.sha256) throw Error("Image hash mismatch");
    const base64 = bytes.toString("base64");
    const counted = await getAnthropic().messages.countTokens({
      model,
      system: readPillPrompt,
      tools: [readPillTool as unknown as Anthropic.Tool],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64,
              },
            },
            {
              type: "text",
              text: "Use the tool and return only the structured reading.",
            },
          ],
        },
      ],
    });
    const value = await budget(
      requestCostBound(model, counted.input_tokens, 1200, 2),
      async () => {
        const t = performance.now();
        try {
          return {
            reading: await readPill({ mediaType: "image/jpeg", base64 }),
            ms: Math.round(performance.now() - t),
          };
        } catch (e) {
          return {
            reading: {
              imprintSides: [],
              imprintConfidence: 0,
              colors: [],
              colorConfidence: 0,
              shape: "",
              shapeConfidence: 0,
            },
            ms: Math.round(performance.now() - t),
            error: e instanceof Error ? e.message : "Reader error",
          };
        }
      },
    );
    cache[key] = value;
    save("research/out/holdout-readings.json", cache);
    console.log(`Read ${Object.keys(cache).length}/150`);
  });
  const pairs = buildPairs(cohort.images, seed);
  const baseline = await read<
    Record<string, { verdict: Observation["verdict"]; raw: string; ms: number }>
  >("research/out/holdout-baseline.json", {});
  phase = "baseline";
  await parallel(pairs, async (pair) => {
    const image = cohort.images.find((i) => i.file === pair.image)!;
    const key = `${image.sha256}:${pair.labelNdc}:direct-v1`;
    if (baseline[key]) return;
    if (!process.argv.includes("--run"))
      throw Error("Missing direct cache; explicit --run required");
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: (await readFile(image.file)).toString("base64"),
            },
          },
          {
            type: "text",
            text: `Here is a photo; the label says ${cohort.products[pair.labelNdc].product.title}, NDC ${pair.labelNdc}. Is this the right pill? Answer MATCH / MISMATCH / UNSURE. Return only one word.`,
          },
        ],
      },
    ];
    const counted = await getAnthropic().messages.countTokens({
      model,
      messages,
      thinking: { type: "between_tools" },
    });
    await budget(
      requestCostBound(model, counted.input_tokens, 128),
      async () => {
        const t = performance.now();
        const response = await getAnthropic().messages.create({
          model,
          max_tokens: 128,
          thinking: { type: "between_tools" },
          output_config: { effort: "high" },
          messages,
        });
        ledger.push({
          phase,
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
          usd:
            (response.usage.input_tokens * 2 +
              response.usage.output_tokens * 10) /
            1e6,
        });
        save("research/out/holdout-cost.json", ledger);
        console.log(`New spend $${spent().toFixed(4)} / $5`);
        const raw = response.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join(" ")
          .trim();
        baseline[key] = {
          raw,
          verdict: /^(MATCH|MISMATCH|UNSURE)$/.test(raw)
            ? (raw as Observation["verdict"])
            : "UNSURE",
          ms: Math.round(performance.now() - t),
        };
        save("research/out/holdout-baseline.json", baseline);
      },
    );
  });
  const rows: Record<string, Row[]> = {
    ...evaluate(cohort, cache, READ_PILL_PROMPT_VERSION),
    "Direct Sonnet": pairs.map((pair) => {
      const image = cohort.images.find((i) => i.file === pair.image)!;
      const b = baseline[`${image.sha256}:${pair.labelNdc}:direct-v1`];
      return { ...pair, ...b };
    }),
  };
  const result = {
    version: 2,
    date: new Date().toISOString(),
    frozenCommit: freeze.commit,
    seed,
    images: 150,
    products: 75,
    pairs: 300,
    hardPairs: pairs.filter((p) => p.difficulty === "hard").length,
    model,
    promptVersion: READ_PILL_PROMPT_VERSION,
    productOverlap: 0,
    totalUsd: spent(),
    skipped: cohort.skipped,
    metrics: Object.fromEntries(
      Object.entries(rows).map(([k, v]) => [k, safetyMetrics(v)]),
    ),
    readerErrors: Object.values(cache).filter((r) => r.error).length,
    meanReadMs: Object.values(cache).reduce((s, r) => s + r.ms, 0) / 150,
    meanBaselineMs: Object.values(baseline).reduce((s, r) => s + r.ms, 0) / 300,
    meanReadUsd:
      ledger.filter((r) => r.phase === "read").reduce((s, r) => s + r.usd, 0) /
      150,
    meanBaselineUsd:
      ledger
        .filter((r) => r.phase === "baseline")
        .reduce((s, r) => s + r.usd, 0) / 300,
  };
  const verified = loadHoldout(result);
  if (!verified)
    throw Error(
      "Computed holdout counts failed validation; refusing publication.",
    );
  if (
    result.totalUsd > 5 ||
    Object.values(result.metrics).some((m) => m.n !== 300)
  )
    throw Error("Incomplete or over-budget run");
  save("research/out/holdout-results.json", result);
  const readme = await readFile("README.md", "utf8");
  await writeFile(
    "README.md",
    readme.replace(
      /<!-- research-headline -->[\s\S]*?<!-- \/research-headline -->/,
      `<!-- research-headline -->\n${holdoutHeadline(verified)} [All safety, coverage and development results](https://getsecondlook.vercel.app/research).\n<!-- /research-headline -->`,
    ),
  );
  const quote = (v: unknown) =>
    `"${String(typeof v === "object" ? JSON.stringify(v) : v).replaceAll('"', '""')}"`;
  await writeFile(
    "research/out/holdout-pairs.csv",
    "method,image,label_ndc,own_ndc,truth,difficulty,reading,verdict\n" +
      Object.entries(rows)
        .flatMap(([method, rs]) =>
          rs.map((r) =>
            [
              method,
              r.image,
              r.labelNdc,
              r.ownNdc,
              r.wrong ? "wrong" : "right",
              r.difficulty,
              r.reading ?? r.raw,
              r.verdict,
            ]
              .map(quote)
              .join(","),
          ),
        )
        .join("\n") +
      "\n",
  );
  const table = Object.entries(result.metrics)
    .map(
      ([k, m]) =>
        `| ${k} | ${m.caught}/${m.wrong} | ${m.wrongPassed}/${m.wrong} | ${m.falseAlarms}/${m.right} | ${m.passed}/${m.right} | ${m.correct}/${m.decisive} | ${percent(m.coverage)} | ${m.unsure}/${m.n} |`,
    )
    .join("\n");
  await writeFile(
    "research/REPORT.md",
    `# Second Look: development and fresh holdout\n\nHoldout run ${result.date}. Frozen implementation commit **${freeze.commit}**. Seed ${seed}, model ${model}, prompt ${READ_PILL_PROMPT_VERSION}. 150 photos / 75 new NDC products / 300 pairs; ${result.hardPairs}/150 wrong pairs are hard look-alikes. Zero development product-code overlap, including package aliases. No implementation changes are allowed after viewing holdout outcomes; hashes are enforced by the runner. Headline method was predeclared as one-view Sonnet, not selected by results.\n\n## Holdout: every safety and usefulness metric together\n\n| Method | Wrong caught | Wrong called fine | False alarms | Right passed | Correct / decisive | Coverage | Unsure |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${table}\n\nDecisive means not UNSURE. Correct decisive answers = right pills passed + wrong pills marked MISMATCH. Wrong passes, false alarms and abstentions are never counted as correct. Do not describe zero observed wrong passes as proven safety.\n\n## Development, never a test headline\n\nThe phase-4 200-photo / 100-product cohort is DEVELOPMENT data now. Its original pill-v1 one-view result was 77/200 wrong caught, 0/200 wrong called fine, 2/200 false alarms, 64/200 right passed, 141/143 correct decisive answers and 143/400 coverage. dev-diagnosis.md records all abstentions; dev-diagnosis.json has all 400 rows. Development two-view evaluation reuses v1 caches with the phase-5 engine, NOT new v2 readings. See development-results.json and PHASE4-REPORT.md. No development images were reread: the entire new budget was reserved for holdout. The optional extra partial-side relaxation was not adopted; the existing matcher already accepts visible subsets.\n\n## Protocol and limitations\n\nOnly consumer C3PI_Test JPG rows from the NIH index, single-part products; two seeded views of 75 product-disjoint codes. To meet the predeclared hard-negative floor, we took the first 100 seeded eligible metadata records, selected 60 in mutual hard-negative pairs, then filled 15 from the remaining seeded order. This look-alike-stratified selection is not prescription-population sampling. FDA imprint, color, shape and all same-drug alternatives come from our RxNav ndcstatus=ALL client and are frozen in holdout-cohort.json. Exact URLs, hashes and skips are in HOLDOUT-DATA.md. Known label NDC, not label OCR. Same deterministic pair rules as development: balanced truth, different generic medicine, non-equivalent imprint, at least 80% hard pairs. Selection and exclusions happened before model outputs. ${cohort.skipped.length} candidates skipped; individual reasons are recorded. ${Object.values(cohort.products).filter((p) => !p.product.active).length} selected records are inactive/discontinued.\n\nTwo-view evaluation merges both existing photos of each product. They are independent archive views, not guaranteed opposite sides or the same physical tablet. There are only 75 unique view-pairs; each is reused for two anchors. All observations are correlated by product and anchor. Two-view union preserves the minimum confidence of nonblank text, ignores a blank side for imprint confidence, and requires exact color agreement plus compatible shape and trusted appearance in both. Conflicts remain UNSURE. Empty/failed readings remain in denominators. Long/odd strings are cleaned and bounded; trimmed imprint confidence is capped below 0.7. The imprint threshold remains 0.7.\n\nDirect baseline sees the same single photos and label drug/strength/NDC, no FDA lookup. Its frozen settings are max_tokens=128, thinking.type=between_tools, output_config.effort=high; reader reasoning retains production defaults. Nonconforming baseline text counts UNSURE. This is a system comparison, not an isolated causal test of deterministic code. Dataset is public and from the 2016 challenge era; training overlap, record changes and controlled backgrounds limit generalization. No size or authenticity measurement, no clinical validation. Different development/holdout distributions prevent a causal before/after accuracy claim.\n\n## Cost, timing, reproduction\n\nNew estimated spend **$${spent().toFixed(6)} / $5**, separate from phase 4's $6.6680584. Every uncached operation reserves token-count input headroom and maximum output/reader retry costs across in-flight requests before launch. SDK network failures without returned usage cannot be billed from the ledger. Both-view evaluations reuse existing reads, with no extra API calls; a real two-photo check would pay for two reads. Mean one-photo read ${(result.meanReadMs / 1000).toFixed(3)} s; direct baseline ${(result.meanBaselineMs / 1000).toFixed(3)} s/pair. These exclude label OCR, FDA lookup, explanation, upload and UI. Reader errors: ${result.readerErrors}/150, retained as UNSURE.\n\nRun npm run research (fully cached report regeneration, no --run). A new paid run requires explicit --run and an existing matching freeze; never reset it to hide a second run. All readings, raw direct replies, usage ledger, all 900 pair outcomes, cohort and freeze hashes are committed. Photos remain ignored; missing files are restored only when a new read needs them, and hashes checked. Holdout outcomes may be reported, not used to tune this release. Future tuning requires another development set and a new untouched holdout.\n\n[NIH index](${base}directory_consumer_grade_images.txt) · [Yaniv et al., dataset paper](https://pubmed.ncbi.nlm.nih.gov/29854569/)\n`,
  );
  console.log(JSON.stringify(result, null, 2));
  const development = await read<{
    metrics: Record<string, ReturnType<typeof safetyMetrics>>;
  } | null>("research/out/development-results.json", null);
  if (development) {
    const table = Object.entries(development.metrics)
      .map(
        ([name, m]) =>
          `| ${name} | ${m.caught}/${m.wrong} | ${m.wrongPassed}/${m.wrong} | ${m.falseAlarms}/${m.right} | ${m.passed}/${m.right} | ${m.correct}/${m.decisive} | ${percent(m.coverage)} | ${m.unsure}/${m.n} |`,
      )
      .join("\n");
    const report = await readFile("research/REPORT.md", "utf8");
    await writeFile(
      "research/REPORT.md",
      report +
        `\n## Development only: current engine, cached v1 readings\n\n| Method | Wrong caught | Wrong called fine | False alarms | Right passed | Correct / decisive | Coverage | Unsure |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${table}\n\nShape cleanup recognizes literal “-shaped” suffixes. Single-view engine checks now honor multiple/absent-pill signals, consistent with the camera pipeline; this adds abstentions versus phase 4, whose pure benchmark engine ignored those flags. The thresholds were not lowered. Strict two-view compatibility costs coverage on development; no outcome was discarded to hide this. The initial unstratified metadata-only holdout candidate pool failed the hard-negative floor. No model call had occurred; the stratification described above was fixed before freezing.\n\nMean model cost per new single-view check $${result.meanReadUsd.toFixed(6)}; direct classification $${result.meanBaselineUsd.toFixed(6)}. Two-view model-reading cost would be approximately twice a single read, excluding label/explanation. Development reread spend: $0.\n`,
    );
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

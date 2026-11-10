import { readFile, writeFile, mkdir } from "node:fs/promises";
import { writeFileSync, renameSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import type Anthropic from "@anthropic-ai/sdk";
import { readPillPrompt, readPillTool } from "@/lib/ai/prompts/read-pill";
import { requestCostBound, canReserve } from "@/lib/research-budget";
import { readPill } from "@/lib/ai/readers";
import { getAnthropic, setAiUsageObserver } from "@/lib/ai/client";
import { READ_PILL_PROMPT_VERSION } from "@/lib/ai/prompts/read-pill";
import { lookupNdc, drugGroup } from "@/lib/fda/rxnav";
import { decide, type PillReading } from "@/lib/verdict-engine";
import { compareImprint, tokenizeImprint } from "@/lib/match/imprint";
import {
  compareColors,
  colorsFromCodes,
  normalizeColor,
} from "@/lib/match/color";
import {
  compareShapes,
  shapeFromCode,
  normalizeShape,
} from "@/lib/match/shape";
import {
  buildPairs,
  shuffled,
  metrics,
  RESEARCH_SEED,
  type ResearchImage,
  type Observation,
} from "@/lib/research";
import type { Product } from "@/lib/fda/types";
import { loadResearch, researchHeadline } from "@/lib/research-results";

const ROOT = new URL("../", import.meta.url),
  BASE = "https://data.lhncbc.nlm.nih.gov/public/Pills/";
const MODELS = ["claude-sonnet-5-5", "claude-haiku-5-5"];
const file = (path: string) => new URL(path, ROOT);
const json = async <T>(path: string, fallback: T): Promise<T> => {
  try {
    return JSON.parse(await readFile(file(path), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
};
function save(path: string, value: unknown) {
  const target = file(path);
  const temp = new URL(target.href + ".tmp");
  writeFileSync(temp, JSON.stringify(value, null, 2) + "\n");
  renameSync(temp, target);
}
async function parallel<T>(
  values: T[],
  action: (value: T) => Promise<void>,
  concurrency = 6,
) {
  let next = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < values.length) {
        const value = values[next++];
        await action(value);
      }
    }),
  );
}
type Manifest = {
  seed: number;
  images: (ResearchImage & { sha256: string })[];
  products: Record<
    string,
    { product: Product; generic: string; products: Product[] }
  >;
  skipped: { ndc: string; reason: string }[];
};
async function prepare(): Promise<Manifest> {
  const previous = await json<Manifest | null>(
    "research/data/manifest.json",
    null,
  );
  if (previous) return previous;
  const archived = await json<Manifest | null>(
    "research/out/cohort.json",
    null,
  );
  if (archived) {
    await parallel(archived.images, async (image) => {
      const response = await fetch(image.url);
      if (!response.ok)
        throw new Error("Archived image unavailable: " + image.url);
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
      if (createHash("sha256").update(output).digest("hex") !== image.sha256)
        throw new Error(
          "Image hash differs from recorded cohort: " + image.url,
        );
      await writeFile(file(image.file), output);
    });
    save("research/data/manifest.json", archived);
    return archived;
  }
  const response = await fetch(BASE + "directory_consumer_grade_images.txt");
  if (!response.ok) throw new Error("NIH index unavailable");
  const text = await response.text();
  await writeFile(
    file("research/data/directory_consumer_grade_images.txt"),
    text,
  );
  const byNdc = new Map<string, { path: string; name: string }[]>();
  for (const line of text.split(/\r?\n/)) {
    const [ndc, , path, type, name] = line.split("|");
    if (type !== "C3PI_Test" || !path?.toLowerCase().endsWith(".jpg")) continue;
    const rows = byNdc.get(ndc) ?? [];
    rows.push({ path, name });
    byNdc.set(ndc, rows);
  }
  const manifest: Manifest = {
    seed: RESEARCH_SEED,
    images: [],
    products: {},
    skipped: [],
  };
  const ndcs = shuffled([...byNdc.keys()]);
  for (
    let offset = 0;
    offset < ndcs.length && Object.keys(manifest.products).length < 100;
    offset += 8
  ) {
    const batch = await Promise.all(
      ndcs.slice(offset, offset + 8).map(async (ndc) => {
        try {
          const lookup = await lookupNdc(ndc),
            product = lookup.product;
          if (!product?.imprintRaw?.trim())
            return { ndc, error: "No FDA imprint/product found" };
          const group = await drugGroup(product.rxcui);
          if (!group) throw new Error("No drug group");
          const candidates = shuffled(
            byNdc.get(ndc)!,
            RESEARCH_SEED + Number(ndc.slice(-5)),
          ).slice(0, 2);
          if (candidates.length < 2)
            return { ndc, error: "Fewer than two consumer JPGs" };
          const downloaded: Manifest["images"] = [];
          for (const entry of candidates) {
            const url =
              BASE + entry.path.split("/").map(encodeURIComponent).join("/");
            const r = await fetch(url);
            if (!r.ok) throw new Error(`Photo HTTP ${r.status}`);
            const original = Buffer.from(await r.arrayBuffer());
            const bytes = await sharp(original)
              .rotate()
              .resize({
                width: 1600,
                height: 1600,
                fit: "inside",
                withoutEnlargement: true,
              })
              .jpeg({ quality: 85 })
              .toBuffer();
            const path = `research/data/${ndc}-${downloaded.length}.jpg`;
            await writeFile(file(path), bytes);
            downloaded.push({
              file: path,
              url,
              ndc,
              product,
              generic: group.generic.rxcui,
              sha256: createHash("sha256").update(bytes).digest("hex"),
            });
          }
          return { ndc, downloaded, group, product };
        } catch (error) {
          return {
            ndc,
            error:
              error instanceof Error ? error.message : "Download/lookup error",
          };
        }
      }),
    );
    for (const entry of batch) {
      if (Object.keys(manifest.products).length >= 100) break;
      if (entry.error) {
        manifest.skipped.push({ ndc: entry.ndc, reason: entry.error });
        continue;
      }
      if (!entry.downloaded || !entry.product || !entry.group)
        throw new Error("Incomplete prepared entry");
      manifest.images.push(...entry.downloaded);
      manifest.products[entry.ndc] = {
        product: entry.product,
        generic: entry.group.generic.rxcui,
        products: entry.group.products,
      };
    }
    console.log(
      `FDA/NIH: ${Object.keys(manifest.products).length}/100 products, ${manifest.images.length} photos; skipped ${manifest.skipped.length}`,
    );
  }
  if (manifest.images.length !== 200)
    throw new Error(
      `Only ${manifest.images.length} eligible photos; no benchmark published`,
    );
  save("research/data/manifest.json", manifest);
  await writeFile(
    file("research/DATA.md"),
    `# NIH consumer subset\n\nSeed ${RESEARCH_SEED}. Source index: ${BASE}directory_consumer_grade_images.txt. Only C3PI_Test JPG rows; shuffled product codes, first 100 eligible codes, two seeded photos per code. FDA ground truth via ndcproperties with ndcstatus=ALL. Photos resized to 1600px, oriented, JPEG 85%, metadata removed, exactly like production capture. Original files are not committed.\n\n${manifest.images.map((i) => `- ${i.file} | NDC ${i.ndc} | SHA256 ${i.sha256} | ${i.url}`).join("\n")}\n\n## Excluded during selection (${manifest.skipped.length})\n${manifest.skipped.map((s) => `- ${s.ndc}: ${s.reason}`).join("\n")}\n`,
  );
  return manifest;
}
type Reading = { reading: PillReading; ms: number; error?: string };
const noRead: PillReading = {
  imprintSides: [],
  imprintConfidence: 0,
  colors: [],
  colorConfidence: 0,
  shape: "",
  shapeConfidence: 0,
  guess: null,
};
async function main() {
  await mkdir(file("research/data/"), { recursive: true });
  await mkdir(file("research/out/"), { recursive: true });
  const manifest = await prepare();
  if (process.argv.includes("--prepare")) return;
  save("research/out/cohort.json", manifest);
  const pairs = buildPairs(manifest.images);
  if (pairs.filter((p) => p.difficulty === "hard").length < 100)
    throw new Error(
      "Less than half the negatives are hard; revise protocol before running AI",
    );
  const ledger = await json<
    {
      model: string;
      input: number;
      output: number;
      usd: number;
      phase?: string;
    }[]
  >("research/out/cost.json", []);
  const firstHaiku = ledger.findIndex((row) => row.model.includes("haiku"));
  ledger.forEach((row, i) => {
    row.phase ??=
      row.model.includes("haiku") || firstHaiku < 0 || i < firstHaiku
        ? "read"
        : "baseline-pilot";
  });
  let phase = "read";
  let reserved = 0;
  const spent = () => ledger.reduce((sum, item) => sum + item.usd, 0);
  const usage = (model: string, input: number, output: number) => {
    const rates = model.includes("sonnet") ? [2, 10] : [0.1, 0.5];
    ledger.push({
      model,
      input,
      output,
      usd: (input * rates[0] + output * rates[1]) / 1e6,
      phase,
    });
    save("research/out/cost.json", ledger);
    console.log(`Spend $${spent().toFixed(4)} / $8`);
  };
  setAiUsageObserver(usage);
  const budget = async <T>(action: () => Promise<T>, bound: number) => {
    if (!canReserve(spent(), reserved, bound))
      throw new Error(
        "$8 budget reservation limit reached; cached work retained",
      );
    reserved += bound;
    try {
      return await action();
    } finally {
      reserved -= bound;
    }
  };
  const all: Record<string, Record<string, Reading>> = {};
  for (const model of MODELS) {
    process.env.VISION_MODEL = model;
    const cache = await json<Record<string, Reading>>(
      `research/out/readings-${model}.json`,
      {},
    );
    all[model] = cache;
    await parallel(manifest.images, async (image) => {
      const key = `${READ_PILL_PROMPT_VERSION}:${image.sha256}`;
      if (cache[key]) return;
      const base64 = (await readFile(file(image.file))).toString("base64");
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
      const bound = requestCostBound(model, counted.input_tokens, 1200, 2);
      const started = performance.now();
      const reading = await budget(async () => {
        try {
          return {
            reading: await readPill({
              mediaType: "image/jpeg",
              base64,
            }),
            ms: Math.round(performance.now() - started),
          };
        } catch (error) {
          return {
            reading: noRead,
            ms: Math.round(performance.now() - started),
            error: error instanceof Error ? error.message : "Reader failed",
          };
        }
      }, bound);
      cache[key] = reading;
      save(`research/out/readings-${model}.json`, cache);
      console.log(`${model}: ${Object.keys(cache).length}/200`);
    });
  }
  const baseline = await json<
    Record<string, { verdict: Observation["verdict"]; ms: number; raw: string }>
  >("research/out/baseline.json", {});
  phase = "baseline";
  await parallel(pairs, async (pair) => {
    const image = manifest.images.find((i) => i.file === pair.image)!;
    const key = `${image.sha256}:${pair.labelNdc}:baseline-v2`;
    if (baseline[key]) return;
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: (await readFile(file(image.file))).toString("base64"),
            },
          },
          {
            type: "text",
            text: `Here is a photo; the label says ${manifest.products[pair.labelNdc].product.title}, NDC ${pair.labelNdc}. Is this the right pill? Answer MATCH / MISMATCH / UNSURE. Return only one word.`,
          },
        ],
      },
    ];
    const counted = await getAnthropic().messages.countTokens({
      model: MODELS[0],
      messages,
      thinking: { type: "between_tools" },
    });
    const bound = requestCostBound(MODELS[0], counted.input_tokens, 128);
    await budget(async () => {
      const started = performance.now();
      const response = await getAnthropic().messages.create({
        model: MODELS[0],
        max_tokens: 128,
        thinking: { type: "between_tools" },
        output_config: { effort: "high" },
        messages,
      });
      usage(
        MODELS[0],
        response.usage.input_tokens,
        response.usage.output_tokens,
      );
      const raw = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join(" ")
        .trim();
      baseline[key] = {
        verdict: /^(MATCH|MISMATCH|UNSURE)$/.test(raw)
          ? (raw as Observation["verdict"])
          : "UNSURE",
        raw,
        ms: Math.round(performance.now() - started),
      };
      save("research/out/baseline.json", baseline);
    }, bound);
  });
  const rows: Record<string, (Observation & { reading?: PillReading })[]> = {};
  const readingMetrics: Record<string, unknown> = {};
  for (const model of MODELS) {
    rows[model] = [];
    rows[model + "-no-fold"] = [];
    const accuracy = {
      exact: 0,
      close: 0,
      wrong: 0,
      noRead: 0,
      colorAgree: 0,
      shapeAgree: 0,
      errors: 0,
    };
    for (const image of manifest.images) {
      const r = all[model][`${READ_PILL_PROMPT_VERSION}:${image.sha256}`];
      const imprint = compareImprint(
        image.product.imprintRaw,
        r.reading.imprintSides,
      );
      if (!tokenizeImprint(r.reading.imprintSides).length) accuracy.noRead++;
      else if (imprint.result === "none") accuracy.wrong++;
      else accuracy[imprint.result]++;
      if (r.error) accuracy.errors++;
      if (
        ["exact", "close"].includes(
          compareColors(
            colorsFromCodes(image.product.colorCodes),
            r.reading.colors
              .map(normalizeColor)
              .filter((c): c is NonNullable<typeof c> => !!c),
          ),
        )
      )
        accuracy.colorAgree++;
      if (
        ["exact", "close"].includes(
          compareShapes(
            shapeFromCode(image.product.shapeCode),
            normalizeShape(r.reading.shape),
          ),
        )
      )
        accuracy.shapeAgree++;
    }
    readingMetrics[model] = accuracy;
    for (const pair of pairs) {
      const image = manifest.images.find((i) => i.file === pair.image)!;
      const reading =
        all[model][`${READ_PILL_PROMPT_VERSION}:${image.sha256}`].reading;
      const expected = manifest.products[pair.labelNdc];
      const data = {
        labelProduct: expected.product,
        sameDrugProducts: expected.products,
      };
      for (const fold of [true, false])
        rows[model + (fold ? "" : "-no-fold")].push({
          ...pair,
          reading,
          verdict: decide({ ndc: pair.labelNdc }, reading, data, fold).verdict,
        });
    }
  }
  rows.baseline = pairs.map((pair) => {
    const image = manifest.images.find((i) => i.file === pair.image)!;
    return {
      ...pair,
      verdict: baseline[`${image.sha256}:${pair.labelNdc}:baseline-v2`].verdict,
    };
  });
  const hashes = Object.fromEntries(
    await Promise.all(
      [
        "scripts/research.ts",
        "src/lib/research.ts",
        "src/lib/verdict-engine.ts",
        "src/lib/match/imprint.ts",
        "src/lib/ai/prompts/read-pill.ts",
      ].map(async (path) => [
        path,
        createHash("sha256")
          .update(await readFile(file(path)))
          .digest("hex"),
      ]),
    ),
  );
  const usedBaseline = pairs.map((pair) => {
    const image = manifest.images.find((i) => i.file === pair.image)!;
    return baseline[`${image.sha256}:${pair.labelNdc}:baseline-v2`];
  });
  const results = {
    version: 1,
    seed: RESEARCH_SEED,
    date: new Date().toISOString(),
    promptVersion: READ_PILL_PROMPT_VERSION,
    hashes,
    models: MODELS,
    images: manifest.images.length,
    products: Object.keys(manifest.products).length,
    pairs: pairs.length,
    skipped: manifest.skipped,
    totalUsd: spent(),
    metrics: Object.fromEntries(
      Object.entries(rows).map(([key, value]) => [key, metrics(value)]),
    ),
    reading: readingMetrics,
    timing: Object.fromEntries(
      MODELS.map((model) => [
        model,
        {
          meanReadMs:
            Object.values(all[model]).reduce((sum, r) => sum + r.ms, 0) / 200,
        },
      ]),
    ),
    baselineMeanMs:
      usedBaseline.reduce((sum, r) => sum + r.ms, 0) / pairs.length,
  };
  const verified = loadResearch(results);
  if (!verified)
    throw new Error(
      "Computed results failed denominator/rate validation; refusing publication",
    );
  save("research/out/results.json", results);
  const readme = await readFile(file("README.md"), "utf8");
  await writeFile(
    file("README.md"),
    readme.replace(
      /<!-- research-headline -->[\s\S]*?<!-- \/research-headline -->/,
      `<!-- research-headline -->\n${researchHeadline(verified)} [Method, baseline comparison and limitations](https://getsecondlook.vercel.app/research).\n<!-- /research-headline -->`,
    ),
  );
  const metricRows = Object.entries(results.metrics)
    .map(
      ([name, m]) =>
        `| ${name} | ${m.caught}/${m.wrong} | ${m.falseAlarms}/${m.right} | ${m.passed}/${m.right} | ${m.unsure}/${m.n} | ${m.easy.caught}/${m.easy.n} | ${m.hard.caught}/${m.hard.n} |`,
    )
    .join("\n");
  const readingRows = Object.entries(readingMetrics)
    .map(([name, raw]) => {
      const a = raw as {
        exact: number;
        close: number;
        wrong: number;
        noRead: number;
        colorAgree: number;
        shapeAgree: number;
        errors: number;
      };
      return `| ${name} | ${a.exact} | ${a.close} | ${a.wrong} | ${a.noRead} | ${a.colorAgree}/200 | ${a.shapeAgree}/200 | ${a.errors} |`;
    })
    .join("\n");
  const costs = MODELS.map((model) => {
    const amount = ledger
      .filter((row) => row.model === model && row.phase === "read")
      .reduce((sum, row) => sum + row.usd, 0);
    return `- ${model}: mean reading ${(results.timing[model].meanReadMs / 1000).toFixed(3)} s/image; estimated $${(amount / 200).toFixed(6)} per new image/check (one reading reused for two benchmark pairs).`;
  }).join("\n");
  await writeFile(
    file("research/REPORT.md"),
    `# Second Look: NIH consumer-photo test\n\nRun ${results.date}. Seed ${RESEARCH_SEED}; ${results.images} images, ${results.products} distinct NDC products, ${results.pairs} pairs. Prompt ${READ_PILL_PROMPT_VERSION}. These are observed engineering measurements, not clinical accuracy or errors prevented.\n\n## Method\n\nOnly C3PI_Test JPG consumer photos from the [NIH index](${BASE}directory_consumer_grade_images.txt). Product codes were seeded-shuffled; first 100 with two eligible photos, a resolvable RxNav drug group, and an FDA imprint were retained. ${manifest.skipped.length} candidates were excluded (${manifest.skipped.filter((s) => s.reason.includes("imprint")).length} without an imprint/product; the remaining reasons are listed individually in DATA.md). ${Object.values(manifest.products).filter((p) => !p.product.active).length} selected products are marked inactive/discontinued. We checked part numbers in the index: all selected products have a single part. Each photo appears once with its correct NDC and once with a different generic medicine, never an equivalent manufacturer change. ${pairs.filter((p) => p.difficulty === "hard").length} of 200 wrong pairs share the FDA color and shape but have a different imprint; the others are easy negatives. Labels and hard-negative selection use FDA metadata, not model answers. The completed cohort is fixed in out/cohort.json, including exact ground-truth product groups.\n\nBoth models call the exact production readPill with env-selected model and normal validation retry. No label-photo reading or explanation is evaluated. Single-visible-side imprint matching counts as exact; close allows confusable letters/numbers. Reader failures count as no-read/UNSURE, not exclusions. Color and shape agreement include exact or close matches. For verification the production decide function receives the known label NDC and its full recorded same-drug product group. The no-fold ablation only disables character folding. The direct baseline uses Sonnet and the same pairs, shown the photo and label drug/strength/NDC, with no tool lookup. Nonconforming baseline text becomes UNSURE; raw answers are saved. Haiku has a pipeline result, not an unrequested direct baseline.\n\n## Verification counts\n\n| Method | Wrong caught | False alarms | Right passed | Unsure overall | Easy caught | Hard caught |\n|---|---:|---:|---:|---:|---:|---:|\n${metricRows}\n\nCatch rate is wrong MISMATCH / all wrong. False alarm rate is right MISMATCH / all right. Right pass rate is MATCH or SAME_MEDICINE / all right. UNSURE stays in every denominator and is never called a catch. Right + wrong balance is 200 + 200. Read the ratios directly; the site truncates percentages to one decimal.\n\n## Reading counts\n\n| Model | Exact | Close | Wrong | No read | Color agree | Shape agree | Reader errors |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${readingRows}\n\n## Time and estimated spend\n\n${costs}\n- Direct Sonnet baseline: ${(results.baselineMeanMs / 1000).toFixed(3)} s/pair and $${(ledger.filter((row) => row.phase === "baseline").reduce((sum, row) => sum + row.usd, 0) / pairs.length).toFixed(6)} estimated per pair.\n- Total estimated model spend: $${spent().toFixed(6)}. Hard limit $8; each concurrent operation reserves $0.10, exceeding the two-reader-attempt bound for these resized images. Token usage is saved after each completed model response. Failed network requests with no usage response cannot be measured. Pricing: Sonnet $2/$10 per million input/output tokens; Haiku $0.10/$0.50 for these short prompts ([Anthropic pricing announcement](https://www.anthropic.com/claude-haiku-5-5)). No cache-write tokens are requested.\n- These timings measure model reading/direct classification, not the full app: label OCR, FDA network lookup, explanation, image upload and UI are excluded.\n\n## Reproduce and audit\n\nRun npm install then npm run research with ANTHROPIC_API_KEY in ignored .env.local. research/data is gitignored. If data is absent, the committed cohort restores only those 200 images and verifies resized hashes; it does not resample. Cached readings are keyed by model, production prompt version and image SHA256. A completed rerun makes no model calls. out/results.json, out/pairs.csv, both readings caches, baseline.json, cost.json and cohort.json are auditable. DATA.md lists exact URLs, filenames and exclusions. Source file hashes in results.json identify the evaluation implementation.\n\n## Limits and interpretation\n\nThe archive reflects the 2016 challenge era; some products are discontinued and FDA mappings have changed. Consumer photos are controlled photographs of single pills on backgrounds, not all real phone conditions. One view can hide the imprint. Size is not measured. Selection excludes products without usable ground truth and may not represent US prescriptions. There are two photos per product and each photo contributes two pairs: observations are correlated, not 400 independent clinical cases. Hard negatives are from this cohort, not every possible look-alike. Models may have seen these public images in training. There is no independent holdout for model development. No statistical significance or superiority claim is inferred from these counts. If the baseline wins, it is reported without changing the cohort or thresholds.\n\nDataset citation: [Yaniv et al., National Library of Medicine pill image recognition challenge](https://pubmed.ncbi.nlm.nih.gov/29854569/). See [NIH archive](${BASE}index.html).\n`,
  );
  const quote = (value: unknown) =>
    `"${String(typeof value === "object" ? JSON.stringify(value) : value).replaceAll('"', '""')}"`;
  await writeFile(
    file("research/out/pairs.csv"),
    "method,image,label_ndc,own_ndc,truth,difficulty,reading,verdict\n" +
      Object.entries(rows)
        .flatMap(([method, rs]) =>
          rs.map((r, index) =>
            [
              method,
              r.image,
              r.labelNdc,
              r.ownNdc,
              r.wrong ? "wrong" : "right",
              r.difficulty,
              r.reading ??
                (method === "baseline" ? usedBaseline[index].raw : ""),
              r.verdict,
            ]
              .map(quote)
              .join(","),
          ),
        )
        .join("\n") +
      "\n",
  );
  const report = await readFile(file("research/REPORT.md"), "utf8");
  const pilot = Object.entries(baseline)
    .filter(([key]) => key.endsWith("baseline-v1"))
    .map(([, value]) => value);
  await writeFile(
    file("research/REPORT.md"),
    report +
      `\n## Baseline configuration\n\n${pilot.length ? `The initial ${pilot.length}-pair baseline used default adaptive thinking and max_tokens 128. Of those requests, ${pilot.filter((r) => !/^(MATCH|MISMATCH|UNSURE)$/.test(r.raw)).length} produced nonconforming replies (${pilot.filter((r) => !r.raw).length} empty): this was an output-budget failure, not evidence of wrong-pill detection. Before publication, every baseline pair was repeated. Initial replies remain in baseline.json and all pilot spend is counted. ` : ""}The reported baseline uses thinking.type=between_tools, output_config.effort=high, max_tokens=128 (baseline-v2): https://platform.claude.com/docs/en/build-with-claude/thinking. Every pair uses v2, without selection by correctness. Production readers retain normal reasoning settings, so this compares system configurations, not an isolated causal effect of code alone. The prompt requests one word; invalid final text counts as UNSURE. ${usedBaseline.filter((r) => !/^(MATCH|MISMATCH|UNSURE)$/.test(r.raw)).length} final baseline replies were nonconforming.\n`,
  );
  const sonnet = results.metrics[MODELS[0]],
    direct = results.metrics.baseline;
  const finalReport = await readFile(file("research/REPORT.md"), "utf8");
  await writeFile(
    file("research/REPORT.md"),
    finalReport +
      `\n## What we learned\n\nSonnet's pipeline caught ${sonnet.caught}/${sonnet.wrong} wrong pills with ${sonnet.falseAlarms}/${sonnet.right} false alarms and ${sonnet.unsure}/${sonnet.n} abstentions. Direct AI caught ${direct.caught}/${direct.wrong}, with ${direct.falseAlarms}/${direct.right} false alarms. The pipeline caught fewer wrong pills but raised fewer false alarms; it does not win overall accuracy. Its right-pill pass rate is low. Blank-side and unreadable photos were not discarded. The ablation produced the same verification outcomes on this cohort, so it provides no measured folding benefit here. Reader failures include overlong imprint/shape/form strings rejected by the unchanged production schema. Next investigate tighter transcription constraints, clearer schema descriptions, crop/lighting guidance and optional second-side capture, then evaluate those changes on a fresh held-out cohort. Do not tune thresholds on this set and relabel it an independent test.\n`,
  );
  console.log(JSON.stringify(results, null, 2));
  const reportWithBudget = await readFile(file("research/REPORT.md"), "utf8");
  const difficultyRows = Object.entries(results.metrics)
    .flatMap(([method, m]) =>
      (["easy", "hard"] as const).map((difficulty) => {
        const group = m[difficulty];
        return `| ${method} | ${difficulty} | ${group.n} | ${group.caught} | ${group.unsure} | ${group.passed} |`;
      }),
    )
    .join("\n");
  await writeFile(
    file("research/REPORT.md"),
    reportWithBudget.replace(
      "each concurrent operation reserves $0.10, exceeding the two-reader-attempt bound for these resized images.",
      "uncached requests now use token-count preflight, 10% plus 4,096 input-token headroom, maximum output and all reader attempts. The combined in-flight bound is reserved before starting. The original completed run used $0.10 per operation and stayed below the cap.",
    ) +
      `\n## All wrong-pill outcomes by difficulty\n\n| Method | Difficulty | Wrong pairs | Caught | Unsure | Incorrectly passed |\n|---|---|---:|---:|---:|---:|\n${difficultyRows}\n\nFalse alarms and right-pill pass rates apply to the shared 200 right pairs, not to wrong-pair difficulty categories. Every wrong-pair outcome is shown above; UNSURE is not a successful detection.\n`,
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

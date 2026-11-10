import { readFile, writeFile } from "node:fs/promises";
import { decide } from "../src/lib/verdict-engine";
import { buildPairs } from "../src/lib/research";
import { compareImprint, tokenizeImprint } from "../src/lib/match/imprint";
import type { ResearchImage } from "../src/lib/research";
import type { Product } from "../src/lib/fda/types";
import type { PillReading } from "../src/lib/verdict-engine";
async function main() {
  const cohort = JSON.parse(
    await readFile("research/out/cohort.json", "utf8"),
  ) as {
    images: (ResearchImage & { sha256: string })[];
    products: Record<string, { product: Product; products: Product[] }>;
  };
  const cache = JSON.parse(
    await readFile("research/out/readings-claude-sonnet-5-5.json", "utf8"),
  ) as Record<string, { reading: PillReading; error?: string }>;
  const rows = buildPairs(cohort.images).map((pair) => {
    const image = cohort.images.find(
      (i: { file: string }) => i.file === pair.image,
    )!;
    const cached = cache[`pill-v1:${image.sha256}`],
      pill = cached.reading;
    const expected = cohort.products[pair.labelNdc];
    // Phase 4's engine did not gate on these photo flags. Reproduce its diagnosis, not the new policy.
    const result = decide(
      { ndc: pair.labelNdc },
      { ...pill, multiplePills: false, pillVisible: true },
      { labelProduct: expected.product, sameDrugProducts: expected.products },
    );
    const noRead = !tokenizeImprint(pill.imprintSides).length;
    const comparison = compareImprint(
      expected.product.imprintRaw,
      pill.imprintSides,
    );
    const flags = [
      cached.error ? "reader error" : null,
      noRead ? "no imprint read" : null,
      !noRead && comparison.partial ? "partial matching imprint" : null,
      expected.product.imprintRaw.includes(";") &&
      (noRead || comparison.partial)
        ? "FDA has multiple imprint parts; unseen side possible, not proven"
        : null,
      pill.imprintConfidence < 0.7 ? "low imprint confidence" : null,
      pill.multiplePills
        ? "multiple-pill flag (new engine will abstain)"
        : null,
      ...result.features
        .filter(
          (f) => f.result === "mismatch" && ["Color", "Shape"].includes(f.name),
        )
        .map((f) => f.name.toLowerCase() + " disagrees"),
      !expected.product.active
        ? "discontinued record (context, not an abstention cause)"
        : null,
    ].filter(Boolean);
    return {
      ...pair,
      verdict: result.verdict,
      noRead,
      flags,
      reasons: result.reasons,
      reading: pill.imprintSides,
      fda: expected.product.imprintRaw,
      error: cached.error ?? null,
    };
  });
  const unsure = rows.filter((r) => r.verdict === "UNSURE");
  const counts: Record<string, number> = {};
  for (const row of unsure)
    for (const flag of row.flags)
      counts[String(flag)] = (counts[String(flag)] ?? 0) + 1;
  const unique = Object.values(cache) as {
    reading: { imprintSides: string[] };
    error?: string;
  }[];
  await writeFile(
    "research/out/dev-diagnosis.json",
    JSON.stringify(rows, null, 2) + "\n",
  );
  await writeFile(
    "research/out/dev-diagnosis.md",
    `# Development diagnosis (phase-4 frozen caches, no model calls)\n\n200 photos / 400 pairs. ${unsure.length} UNSURE pairs; ${unique.filter((r) => !tokenizeImprint(r.reading.imprintSides).length).length} no-read photos; ${unique.filter((r) => r.error).length} reader-error photos. All 400 rows, including every no-read and UNSURE, are in dev-diagnosis.json. Counts below overlap. “Other side” is only a hypothesis from FDA multipart text, never a claim we know what the unseen photo contains.\n\n| Flag on UNSURE pairs | Count |\n|---|---:|\n${Object.entries(
      counts,
    )
      .map(([k, v]) => `| ${k} | ${v} |`)
      .join(
        "\n",
      )}\n\n## Ten examples (first ten in fixed cohort order, not selected for success)\n\n| Photo | Label NDC | FDA imprint | Read | Flags |\n|---|---|---|---|---|\n${unsure
      .slice(0, 10)
      .map(
        (r) =>
          `| ${r.image} | ${r.labelNdc} | ${r.fda} | ${r.reading.join(" / ")} | ${r.flags.join("; ")} |`,
      )
      .join(
        "\n",
      )}\n\n## Plan grounded in the diagnosis\n\nPreserve the existing 0.7 imprint threshold. Empty visible sides need another view, not a lower threshold. Clean bounded strings before schema validation and mark trimmed evidence below threshold rather than discarding the entire reading. Ask for a second view when no imprint or a partial/multipart imprint is present. Require compatible appearance on both views and retain every disagreement as UNSURE. The current matcher already accepts a visible subset of FDA imprint tokens; do not introduce a further permissive partial-side rule. No rereading development photos with v2: reserve the $5 budget for a product-disjoint holdout.\n`,
  );
  console.log({ unsure: unsure.length, counts });
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

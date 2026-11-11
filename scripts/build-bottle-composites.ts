import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";
import type { LabelReading } from "@/lib/verdict-engine";
import type { Product } from "@/lib/fda/types";

export const BOTTLE_OUTPUT = "test-images/bottle/generated";
export type CompositeScenario = { id: string; image: string; label: LabelReading; expectedCount: number; expectedMix: { file: string; count: number; productCode: string }[]; purpose: string };
type CohortImage = { file: string; ndc: string; product: Product; sha256: string };
const root = fileURLToPath(new URL("../", import.meta.url));
// Visually inspected source bounds and silhouette masks. Only the fixture builder uses these.
// Pixel colors/imprints are the original consumer photograph; no AI or synthetic pill artwork.
const masks = [
  { left: 677, top: 443, width: 304, height: 160, radius: 72 },
  { left: 663, top: 480, width: 274, height: 278, radius: 0 },
  { left: 218, top: 73, width: 211, height: 237, radius: 0 },
];
const selected = ["research/data/42043019205-1.jpg", "research/data/62037067410-1.jpg", "research/data/00591090030-1.jpg"];

export async function buildBottleComposites() {
  const cohort = JSON.parse(await readFile(path.join(root, "research/out/cohort.json"), "utf8")) as { images: CohortImage[] };
  const holdout = JSON.parse(await readFile(path.join(root, "research/out/holdout-cohort.json"), "utf8")) as { images: CohortImage[] };
  const held = new Set(holdout.images.map((i) => i.product.productCode));
  const sources = await Promise.all(selected.map(async (file, index) => {
    const item = cohort.images.find((i) => i.file === file);
    if (!item || held.has(item.product.productCode)) throw new Error(`Ineligible development input: ${file}`);
    const bytes = await readFile(path.join(root, file));
    if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error(`Development source hash changed: ${file}`);
    const bounds = masks[index], { width, height } = bounds;
    const outline = bounds.radius
      ? `<rect width="${width}" height="${height}" rx="${bounds.radius}" fill="white"/>`
      : `<ellipse cx="${width/2}" cy="${height/2}" rx="${width/2}" ry="${height/2}" fill="white"/>`;
    const alpha = Buffer.from(`<svg width="${width}" height="${height}">${outline}</svg>`);
    const cutout = await sharp(bytes).extract({ left: bounds.left, top: bounds.top, width, height }).ensureAlpha().composite([{ input: alpha, blend: "dest-in" }]).png().toBuffer();
    return { item, cutout, meta: await sharp(cutout).metadata() };
  }));
  await mkdir(path.join(root, BOTTLE_OUTPUT), { recursive: true });
  const labelFor = (i: number): LabelReading => ({ ndc: sources[i].item.product.ndc9, drugName: sources[i].item.product.title, isPrescriptionLabel: true, confidence: { drugName: 1, ndc: 1, strength: 1, form: 1 } });
  // Identical placement/scale preserves byte-identical repeated crops for honest cache reuse.
  const specs = [
    { id: "blue-eight-plus-white", pills: [...Array<number>(8).fill(0), 1], label: labelFor(0), purpose: "8 blue levetiracetam pills and 1 white metformin pill, declared levetiracetam label" },
    { id: "blue-nine", pills: Array<number>(9).fill(0), label: labelFor(0), purpose: "9 repeated blue levetiracetam consumer crops, declared levetiracetam label" },
    { id: "orange-eight-plus-blue", pills: [...Array<number>(8).fill(2), 0], label: labelFor(2), purpose: "8 orange glipizide pills and 1 blue levetiracetam pill, declared glipizide label" },
  ];
  const scenarios: CompositeScenario[] = [];
  for (const spec of specs) {
    const layers = spec.pills.map((s, i) => ({ input: sources[s].cutout, left: 100 + (i % 3) * 450 + Math.floor((320 - sources[s].meta.width!) / 2), top: 100 + Math.floor(i / 3) * 360 + Math.floor((260 - sources[s].meta.height!) / 2) }));
    const image = `${BOTTLE_OUTPUT}/${spec.id}.png`;
    await sharp({ create: { width: 1440, height: 1180, channels: 3, background: "#f4df88" } }).composite(layers).png().toFile(path.join(root, image));
    const expectedMix = [...new Set(spec.pills)].map((s) => ({ file: selected[s], count: spec.pills.filter((x) => x === s).length, productCode: sources[s].item.product.productCode }));
    scenarios.push({ id: spec.id, image, label: spec.label, expectedCount: 9, expectedMix, purpose: spec.purpose });
  }
  const manifest = { scope: "Functional composites selected from DEVELOPMENT only. Not fresh benchmark evidence. Labels are declared FDA groundtruth, not live label readings.", sources: sources.map((s, i) => ({ file: s.item.file, sha256: s.item.sha256, productCode: s.item.product.productCode, sourceBounds: masks[i], preparation: "Manually inspected crop bounds with elliptical/rounded silhouette masking; original pill pixels, repeated functional-demo composites only" })), scenarios };
  await writeFile(path.join(root, BOTTLE_OUTPUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Built 3 development-only composites in ${BOTTLE_OUTPUT}. No AI calls. Repeated crops are intentional; this is not an accuracy test.`);
  return manifest;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildBottleComposites().catch((e) => { console.error(e instanceof Error ? e.message : "Composite build failed"); process.exitCode = 1; });

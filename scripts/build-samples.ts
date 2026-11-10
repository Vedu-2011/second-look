import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { buildSamples } from "@/lib/samples-build";
import { runPhotoCheck } from "@/lib/photo-check";

const root = new URL("../", import.meta.url);
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";
async function main() {
const outcomes = await buildSamples({
  async readPair(id) {
    const read = async (name: string) => readFile(new URL(`test-images/real/${id}/${name}.jpg`, root)).catch(error => { if (missing(error)) return null; throw error; });
    const [label, pill] = await Promise.all([read("label"), read("pill")]);
    if (!label && !pill) return null;
    if (!label || !pill) throw new Error("Add both label.jpg and pill.jpg; the previous sample was kept.");
    return { label, pill };
  },
  async prepare(bytes) {
    // rotate applies EXIF orientation; sharp drops EXIF metadata from the output by default.
    const output = await sharp(bytes).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    if (output.length > 1_400_000) throw new Error("Photo remains too large after resizing. Use a smaller source image.");
    return { bytes: output, image: { mediaType: "image/jpeg", base64: output.toString("base64") } };
  },
  check: runPhotoCheck,
  async save(id, checked, images) {
    const dir = new URL(`public/samples/${id}/`, root);
    await mkdir(dir, { recursive: true });
    const photos = { label: "", pill: "" };
    for (const kind of ["label", "pill"] as const) {
      const hash = createHash("sha256").update(images[kind].bytes).digest("hex").slice(0, 12);
      const filename = `${kind}-${hash}.jpg`;
      await writeFile(new URL(filename, dir), images[kind].bytes);
      photos[kind] = `/samples/${id}/${filename}`;
    }
    const target = new URL(`src/lib/sample-results/${id}.json`, root);
    const temporary = new URL(`src/lib/sample-results/${id}.json.tmp`, root);
    await writeFile(temporary, JSON.stringify({ ...checked, photos }, null, 2) + "\n");
    await rename(temporary, target);
  },
});
for (const outcome of outcomes) console.log(`${outcome.id}: ${outcome.status === "kept" ? "no photos; keeping the saved FDA example" : outcome.status === "saved" ? outcome.verdict : `FAILED: ${outcome.error}`}`);
if (outcomes.some(outcome => outcome.status === "failed")) process.exitCode = 1;
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Sample build failed."); process.exitCode = 1; });

// Free, deterministic (no AI): runs the segmenter and free coaching on every real photo in test-images/real.
// Usage: node --import tsx scripts/segment-real.ts [label]   → prints one JSON line per photo.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { captureCoaching } from "@/lib/bottle/coaching";
import { segmentBottle } from "@/lib/bottle/segment";

async function main() {
  const label = process.argv[2] ?? "current";
  const photos = ["bottle/pills.jpg", "bottle/pills-flipped.jpg", ...(await readdir("test-images/real/extra")).filter((f) => f.endsWith(".jpg") && f !== "labels-sheet-photo.jpg").map((f) => `extra/${f}`)];
  for (const photo of photos) {
    try {
      const s = await segmentBottle(await readFile(path.join("test-images/real", photo)));
      console.log(JSON.stringify({ label, photo, numbered: s.boxes.length, unchecked: s.clumps.length, touching: s.clumps.filter((c) => c.kind === "touching").length, cutoff: s.clumps.filter((c) => c.kind === "cutoff").length, coaching: captureCoaching(s) }));
    } catch (e) { console.log(JSON.stringify({ label, photo, error: e instanceof Error ? e.message : String(e) })); }
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });

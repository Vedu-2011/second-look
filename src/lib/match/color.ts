// Color matching between what we see in a photo and the FDA's color codes. Photos shift colors (warm light makes
// white look cream, orange look brown), so near colors count as "close", never as a mismatch on their own.
import { colorFor, splitCodes, type PillColor } from "@/lib/fda/codes";

export type ColorMatch = "exact" | "close" | "different";
export type ColorWord = PillColor | "off-white" | "beige";

const SYNONYMS: Record<string, ColorWord> = {
  grey: "gray",
  silver: "gray",
  cream: "off-white",
  ivory: "off-white",
  offwhite: "off-white",
  "off white": "off-white",
  tan: "beige",
  khaki: "beige",
  maroon: "red",
  crimson: "red",
  lavender: "purple",
  violet: "purple",
  lilac: "purple",
  teal: "turquoise",
  aqua: "turquoise",
  cyan: "turquoise",
  peach: "orange",
  salmon: "orange",
  gold: "yellow",
  golden: "yellow",
  rose: "pink",
};

const WORDS = new Set<ColorWord>([
  "black", "blue", "brown", "gray", "green", "orange", "pink", "purple", "red", "turquoise", "white", "yellow",
  "off-white", "beige",
]);

/** "Light Orange" / "GREY" / "pinkish brown" → "orange" / "gray" / "brown". null when we don't know the word. */
export function normalizeColor(input: string | null | undefined): ColorWord | null {
  if (!input) return null;
  let s = input.toLowerCase().trim().replace(/[_]/g, " ");
  if (SYNONYMS[s]) return SYNONYMS[s];
  s = s.replace(/\b(light|dark|pale|bright|deep|very|mottled|speckled)\b/g, "").replace(/-ish\b|ish\b/g, "").trim();
  if (SYNONYMS[s]) return SYNONYMS[s];
  if (WORDS.has(s as ColorWord)) return s as ColorWord;
  // "pinkish brown", "brown (pinkish brown)": the last known color word is the main one.
  const words = s.split(/[^a-z-]+/).filter(Boolean).map((w) => SYNONYMS[w] ?? w);
  const known = words.filter((w): w is ColorWord => WORDS.has(w as ColorWord));
  return known.length ? known[known.length - 1] : null;
}

/** FDA codes ("C48325;C48331" or array) → color words. */
export function colorsFromCodes(codes: string | readonly string[] | null | undefined): ColorWord[] {
  return splitCodes(codes)
    .map((c) => colorFor(c)?.color)
    .filter((c): c is PillColor => Boolean(c));
}

const CLOSE_PAIRS: [ColorWord, ColorWord][] = [
  ["white", "gray"],
  ["white", "off-white"],
  ["gray", "off-white"],
  ["white", "beige"],
  ["off-white", "beige"],
  ["beige", "brown"],
  ["brown", "orange"],
  ["brown", "red"],
  ["brown", "pink"],
  ["orange", "red"],
  ["pink", "red"],
  ["yellow", "orange"],
  ["yellow", "beige"],
  ["purple", "blue"],
  ["purple", "pink"],
  ["green", "turquoise"],
  ["blue", "turquoise"],
];

export function colorPair(a: ColorWord, b: ColorWord): ColorMatch {
  if (a === b) return "exact";
  return CLOSE_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a)) ? "close" : "different";
}

/**
 * Compare the pill's colors with a product's colors. Two-tone products need both colors; a photo that shows only
 * one of them counts as close (the other half may be out of view or in shadow).
 */
export function compareColors(fda: readonly ColorWord[], pill: readonly ColorWord[]): ColorMatch | "unknown" {
  if (fda.length === 0 || pill.length === 0) return "unknown";
  const best = (c: ColorWord, pool: readonly ColorWord[]) => {
    const results = pool.map((p) => colorPair(c, p));
    return results.includes("exact") ? "exact" : results.includes("close") ? "close" : "different";
  };
  const pillToFda = pill.map((c) => best(c, fda));
  const fdaToPill = fda.map((c) => best(c, pill));
  if (pillToFda.includes("different")) return "different";
  if (fdaToPill.includes("different")) {
    // Pill shows a subset of a two-tone product's colors.
    return pill.length < fda.length ? "close" : "different";
  }
  return [...pillToFda, ...fdaToPill].every((r) => r === "exact") ? "exact" : "close";
}

// Shape matching. The FDA's "CAPSULE" shape is also used for caplet TABLETS, and long pills photographed at an
// angle look oval, so oval / capsule / oblong / rectangle are "close" to each other.
import { shapeFor, type PillShape } from "@/lib/fda/codes";

export type ShapeMatch = "exact" | "close" | "different";
export type ShapeWord = PillShape | "oblong";

const SYNONYMS: Record<string, ShapeWord> = {
  circle: "round",
  circular: "round",
  disc: "round",
  disk: "round",
  caplet: "oblong",
  elongated: "oblong",
  "oval/capsule": "oval",
  egg: "oval",
  ellipse: "oval",
  elliptical: "oval",
  rectangular: "rectangle",
  "semi circle": "semi-circle",
  semicircle: "semi-circle",
  "half circle": "semi-circle",
  teardrop: "tear",
  "double-circle": "double circle",
  "5-sided": "pentagon",
  "6-sided": "hexagon",
  "7-sided": "heptagon",
  "8-sided": "octagon",
  "3-sided": "triangle",
  "4-sided": "square",
};

const SHAPES = new Set<string>([
  "bullet", "capsule", "clover", "diamond", "double circle", "freeform", "gear", "heptagon", "hexagon", "octagon",
  "oval", "pentagon", "rectangle", "round", "semi-circle", "square", "tear", "trapezoid", "triangle", "oblong",
]);

export function normalizeShape(input: string | null | undefined): ShapeWord | null {
  if (!input) return null;
  const s = input.toLowerCase().trim().replace(/-shaped\b/g, "").replace(/\s*\(.*\)\s*$/, "").replace(/\s+/g, " ");
  if (SYNONYMS[s]) return SYNONYMS[s];
  if (SHAPES.has(s)) return s as ShapeWord;
  const word = s.split(/[^a-z-]+/).find((w) => SHAPES.has(w) || SYNONYMS[w]);
  return word ? (SYNONYMS[word] ?? (word as ShapeWord)) : null;
}

export function shapeFromCode(code: string | null | undefined): ShapeWord | null {
  return code ? (shapeFor(code)?.shape ?? null) : null;
}

const LONG = new Set<ShapeWord>(["oval", "capsule", "oblong", "rectangle"]);

export function compareShapes(fda: ShapeWord | null, pill: ShapeWord | null): ShapeMatch | "unknown" {
  if (!fda || !pill) return "unknown";
  if (fda === pill) return "exact";
  if (LONG.has(fda) && LONG.has(pill)) return "close";
  return "different";
}

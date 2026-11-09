// FDA SPL (Structured Product Labeling) appearance codes. These are NCI Thesaurus concept codes that
// show up in RxNav ndcproperties (COLOR, SHAPE) and in DailyMed SPL XML (SPLCOLOR, SPLSHAPE).
//
// Verified against FDA's own lists on Nov 8, 2026:
//   Colors: https://www.fda.gov/industry/structured-product-labeling-resources/spl-color  (value set C48556)
//   Shapes: https://www.fda.gov/industry/structured-product-labeling-resources/spl-shape  (value set C48557)
//
// Note: RxNav packs two-tone products into ONE value, e.g. COLOR "C48325;C48331" (white + orange).
// Use splitCodes() before looking codes up.

export type PillColor =
  | "black"
  | "blue"
  | "brown"
  | "gray"
  | "green"
  | "orange"
  | "pink"
  | "purple"
  | "red"
  | "turquoise"
  | "white"
  | "yellow";

// `hex` is OUR display color for drawing the pill. The FDA only names the color.
export const COLOR_CODES: Record<string, { color: PillColor; name: string; hex: string }> = {
  C48323: { color: "black", name: "Black", hex: "#2E2F33" },
  C48333: { color: "blue", name: "Blue", hex: "#5B86C9" },
  C48332: { color: "brown", name: "Brown", hex: "#A8705A" },
  C48324: { color: "gray", name: "Gray", hex: "#A9AEB6" },
  C48329: { color: "green", name: "Green", hex: "#62A877" },
  C48331: { color: "orange", name: "Orange", hex: "#EE8C3A" },
  C48328: { color: "pink", name: "Pink", hex: "#F1AFC0" },
  C48327: { color: "purple", name: "Purple", hex: "#9478C2" },
  C48326: { color: "red", name: "Red", hex: "#CE4A41" },
  C48334: { color: "turquoise", name: "Turquoise", hex: "#45B8B3" },
  C48325: { color: "white", name: "White", hex: "#F8F8F5" },
  C48330: { color: "yellow", name: "Yellow", hex: "#F2D45C" },
};

export type PillShape =
  | "bullet"
  | "capsule"
  | "clover"
  | "diamond"
  | "double circle"
  | "freeform"
  | "gear"
  | "heptagon"
  | "hexagon"
  | "octagon"
  | "oval"
  | "pentagon"
  | "rectangle"
  | "round"
  | "semi-circle"
  | "square"
  | "tear"
  | "trapezoid"
  | "triangle";

export const SHAPE_CODES: Record<string, { shape: PillShape; name: string }> = {
  C48335: { shape: "bullet", name: "Bullet" },
  C48336: { shape: "capsule", name: "Capsule" },
  C48337: { shape: "clover", name: "Clover" },
  C48338: { shape: "diamond", name: "Diamond" },
  C48339: { shape: "double circle", name: "Double circle" },
  C48340: { shape: "freeform", name: "Freeform" },
  C48341: { shape: "gear", name: "Gear" },
  C48342: { shape: "heptagon", name: "Heptagon" },
  C48343: { shape: "hexagon", name: "Hexagon" },
  C48344: { shape: "octagon", name: "Octagon" },
  C48345: { shape: "oval", name: "Oval" },
  C48346: { shape: "pentagon", name: "Pentagon" },
  C48347: { shape: "rectangle", name: "Rectangle" },
  C48348: { shape: "round", name: "Round" },
  C48349: { shape: "semi-circle", name: "Semi-circle" },
  C48350: { shape: "square", name: "Square" },
  C48351: { shape: "tear", name: "Tear" },
  C48352: { shape: "trapezoid", name: "Trapezoid" },
  C48353: { shape: "triangle", name: "Triangle" },
};

/** "C48325;C48331" or ["C48325", "C48331"] → ["C48325", "C48331"] (trimmed, uppercased, empties dropped). */
export function splitCodes(codes: string | readonly string[] | undefined | null): string[] {
  if (!codes) return [];
  const list = typeof codes === "string" ? [codes] : codes;
  return list
    .flatMap((c) => c.split(";"))
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}

export function colorFor(code: string) {
  return COLOR_CODES[code.trim().toUpperCase()];
}

export function shapeFor(code: string) {
  return SHAPE_CODES[code.trim().toUpperCase()];
}

/** Human color name(s): "C48325;C48331" → "White and orange". Unknown codes are skipped. */
export function colorNames(codes: string | readonly string[] | undefined | null): string | null {
  const names = splitCodes(codes)
    .map((c) => colorFor(c)?.color)
    .filter((c): c is PillColor => Boolean(c));
  if (names.length === 0) return null;
  const text = names.join(" and ");
  return text[0].toUpperCase() + text.slice(1);
}

export function shapeName(code: string | undefined | null): string | null {
  return code ? (shapeFor(code)?.name ?? null) : null;
}

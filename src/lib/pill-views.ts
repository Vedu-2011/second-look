import type { PillReading } from "./verdict-engine";
import type { Product } from "./fda/types";
import { compareImprint, tokenizeImprint } from "./match/imprint";
import { compareColors, normalizeColor } from "./match/color";
import { compareShapes, normalizeShape } from "./match/shape";

/** Only combine photographs of the SAME pill. Empty sides contribute no imprint confidence. */
export function mergePillViews(views: readonly PillReading[]): PillReading {
  if (views.length === 1) return views[0];
  const first = views[0];
  if (!first || views.length !== 2)
    throw new Error("Use one or two views of the same pill.");
  const second = views[1];
  const colors = views.map((v) =>
    v.colors.map(normalizeColor).filter((c): c is NonNullable<typeof c> => !!c),
  );
  const shapes = views.map((v) => normalizeShape(v.shape));
  const colorMatch = compareColors(colors[0], colors[1]);
  const colorTrusted = views.every((v) => v.colorConfidence >= 0.5) && colorMatch !== "unknown";
  const colorAgrees = colorMatch !== "different";
  const shapeMatch = compareShapes(shapes[0], shapes[1]);
  const shapeTrusted = views.every((v) => v.shapeConfidence >= 0.5) && shapeMatch !== "unknown";
  const shapeAgrees = shapeMatch !== "different";
  const visible = views.every(
    (v) => v.pillVisible !== false && !v.multiplePills,
  );
  const textViews = views.filter(
    (v) => tokenizeImprint(v.imprintSides).length > 0,
  );
  return {
    ...first,
    imprintSides: [
      ...new Set(
        textViews
          .flatMap((v) => v.imprintSides)
          .filter((s) => tokenizeImprint(s).length),
      ),
    ],
    imprintConfidence: textViews.length
      ? Math.min(...textViews.map((v) => v.imprintConfidence))
      : 0,
    colors: [...new Set([...first.colors, ...second.colors])],
    colorConfidence: Math.min(first.colorConfidence, second.colorConfidence),
    shapeConfidence: Math.min(first.shapeConfidence, second.shapeConfidence),
    pillVisible: visible,
    multiplePills: views.some((v) => v.multiplePills),
    viewCount: 2,
    viewConflict: !visible
      ? "Both photos must show one pill."
      : !colorTrusted || !shapeTrusted
        ? "We could not clearly read the appearance in both photos."
      : !colorAgrees
        ? "The color does not agree across the two photos."
        : !shapeAgrees
          ? "The shape does not agree across the two photos."
          : undefined,
    photoProblems: [...new Set(views.flatMap((v) => v.photoProblems ?? []))],
    guess: textViews.find((v) => v.guess)?.guess ?? null,
  };
}
export function flipReason(
  pill: PillReading,
  expected?: Product | null,
): string | null {
  if (!tokenizeImprint(pill.imprintSides).length)
    return "We could not read an imprint on this side.";
  if (pill.imprintConfidence < 0.7)
    return "The imprint is not clear enough yet.";
  if (expected) {
    const comparison = compareImprint(expected.imprintRaw, pill.imprintSides);
    if (
      comparison.partial ||
      expected.imprintRaw.split(";").filter((s) => tokenizeImprint(s).length)
        .length > 1
    )
      return "The FDA record lists more imprint text. Another view may help.";
  }
  return null;
}

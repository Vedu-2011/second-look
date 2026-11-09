// Turn what was read off a pill ("orange", "oval") into FDA codes, so <PillDrawing> can draw "what's in your bottle"
// with the same renderer as the FDA record.
import { COLOR_CODES, SHAPE_CODES } from "@/lib/fda/codes";
import { normalizeColor, type ColorWord } from "./color";
import { normalizeShape, type ShapeWord } from "./shape";

const colorCode = (c: ColorWord) => {
  const word = c === "off-white" ? "white" : c === "beige" ? "brown" : c;
  return Object.entries(COLOR_CODES).find(([, v]) => v.color === word)?.[0];
};

const shapeCode = (s: ShapeWord) => {
  const word = s === "oblong" ? "rectangle" : s;
  return Object.entries(SHAPE_CODES).find(([, v]) => v.shape === word)?.[0];
};

export function readingAppearance(pill: { colors: string[]; shape: string }) {
  const colorCodes = pill.colors
    .map(normalizeColor)
    .flatMap((c) => (c ? [colorCode(c)] : []))
    .filter((c): c is string => Boolean(c))
    .slice(0, 2);
  const shape = normalizeShape(pill.shape);
  return { colorCodes, shapeCode: (shape && shapeCode(shape)) || "C48348" };
}

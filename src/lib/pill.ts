// Pure helpers behind <PillDrawing>. Everything is in millimetres, with the pill centred on (0, 0),
// so the component can scale any shape around its centre and draw it to true size.

import { colorFor, shapeFor, splitCodes, type PillShape } from "./fda/codes";

export type PillGeometry = {
  shape: PillShape;
  /** Shape we actually draw. Differs from `shape` only when we fall back. */
  drawn: "round" | "oval" | "capsule" | "rectangle" | "square" | "diamond" | "triangle" | "polygon";
  width: number;
  height: number;
  path: string;
  /** True when we don't have a drawing for this FDA shape and drew a round tablet instead. */
  fallback: boolean;
};

const r2 = (n: number) => Math.round(n * 1000) / 1000;

/** Short side ÷ long side for each elongated shape. The FDA only gives the longest dimension. */
export const ASPECT = { oval: 0.56, capsule: 0.37, rectangle: 0.45, diamond: 0.72 } as const;

function ellipsePath(rx: number, ry: number) {
  return `M ${r2(-rx)} 0 A ${r2(rx)} ${r2(ry)} 0 1 0 ${r2(rx)} 0 A ${r2(rx)} ${r2(ry)} 0 1 0 ${r2(-rx)} 0 Z`;
}

function roundedRectPath(w: number, h: number, r: number) {
  const x = w / 2;
  const y = h / 2;
  const rr = Math.min(r, x, y);
  return [
    `M ${r2(-x + rr)} ${r2(-y)}`,
    `H ${r2(x - rr)}`,
    `A ${r2(rr)} ${r2(rr)} 0 0 1 ${r2(x)} ${r2(-y + rr)}`,
    `V ${r2(y - rr)}`,
    `A ${r2(rr)} ${r2(rr)} 0 0 1 ${r2(x - rr)} ${r2(y)}`,
    `H ${r2(-x + rr)}`,
    `A ${r2(rr)} ${r2(rr)} 0 0 1 ${r2(-x)} ${r2(y - rr)}`,
    `V ${r2(-y + rr)}`,
    `A ${r2(rr)} ${r2(rr)} 0 0 1 ${r2(-x + rr)} ${r2(-y)}`,
    "Z",
  ].join(" ");
}

/** Polygon with softened corners (real tablets never have sharp points). */
function roundedPolygonPath(points: [number, number][], radius: number) {
  const n = points.length;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const [px, py] = points[(i - 1 + n) % n];
    const [cx, cy] = points[i];
    const [nx, ny] = points[(i + 1) % n];
    const toPrev = Math.hypot(px - cx, py - cy);
    const toNext = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(radius, toPrev / 2, toNext / 2);
    const ax = cx + ((px - cx) / toPrev) * r;
    const ay = cy + ((py - cy) / toPrev) * r;
    const bx = cx + ((nx - cx) / toNext) * r;
    const by = cy + ((ny - cy) / toNext) * r;
    parts.push(`${i === 0 ? "M" : "L"} ${r2(ax)} ${r2(ay)} Q ${r2(cx)} ${r2(cy)} ${r2(bx)} ${r2(by)}`);
  }
  return `${parts.join(" ")} Z`;
}

function regularPolygon(sides: number, radius: number): [number, number][] {
  return Array.from({ length: sides }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    return [Math.cos(a) * radius, Math.sin(a) * radius];
  });
}

const POLYGON_SIDES: Partial<Record<PillShape, number>> = {
  pentagon: 5,
  hexagon: 6,
  heptagon: 7,
  octagon: 8,
};

/** Size and outline for an FDA shape code at `sizeMm` (the FDA's longest dimension). */
export function pillGeometry(shapeCode: string, sizeMm: number): PillGeometry {
  const size = Number.isFinite(sizeMm) && sizeMm > 0 ? sizeMm : 10;
  const shape = shapeFor(shapeCode)?.shape ?? "freeform";
  const base = { shape, fallback: false };

  switch (shape) {
    case "round":
      return { ...base, drawn: "round", width: size, height: size, path: ellipsePath(size / 2, size / 2) };
    case "oval": {
      const h = size * ASPECT.oval;
      return { ...base, drawn: "oval", width: size, height: h, path: ellipsePath(size / 2, h / 2) };
    }
    case "capsule": {
      const h = size * ASPECT.capsule;
      return { ...base, drawn: "capsule", width: size, height: h, path: roundedRectPath(size, h, h / 2) };
    }
    case "rectangle": {
      const h = size * ASPECT.rectangle;
      return { ...base, drawn: "rectangle", width: size, height: h, path: roundedRectPath(size, h, h * 0.38) };
    }
    case "square": {
      // FDA size is the longest dimension, so for a square that's the diagonal-free side length.
      return { ...base, drawn: "square", width: size, height: size, path: roundedRectPath(size, size, size * 0.18) };
    }
    case "diamond": {
      const h = size * ASPECT.diamond;
      const pts: [number, number][] = [
        [0, -h / 2],
        [size / 2, 0],
        [0, h / 2],
        [-size / 2, 0],
      ];
      return { ...base, drawn: "diamond", width: size, height: h, path: roundedPolygonPath(pts, size * 0.08) };
    }
    case "triangle": {
      const h = (size * Math.sqrt(3)) / 2;
      const pts: [number, number][] = [
        [0, -h / 2],
        [size / 2, h / 2],
        [-size / 2, h / 2],
      ];
      return { ...base, drawn: "triangle", width: size, height: h, path: roundedPolygonPath(pts, size * 0.12) };
    }
    default: {
      const sides = POLYGON_SIDES[shape];
      if (sides) {
        const pts = regularPolygon(sides, size / 2);
        const ys = pts.map((p) => p[1]);
        const xs = pts.map((p) => p[0]);
        return {
          ...base,
          drawn: "polygon",
          width: r2(Math.max(...xs) - Math.min(...xs)),
          height: r2(Math.max(...ys) - Math.min(...ys)),
          path: roundedPolygonPath(pts, size * 0.07),
        };
      }
      // Bullet, clover, gear, tear, semi-circle, double circle, trapezoid, freeform:
      // draw a round tablet and let the caller say the shape in words.
      return { ...base, drawn: "round", width: size, height: size, path: ellipsePath(size / 2, size / 2), fallback: true };
    }
  }
}

const UNKNOWN_FILL = "#D9DCE1";

/** Display fills for the pill body: one color, or two for two-tone products (left half, right half). */
export function pillFills(colorCodes: string | readonly string[] | undefined | null): string[] {
  const hexes = splitCodes(colorCodes)
    .map((c) => colorFor(c)?.hex)
    .filter((h): h is string => Boolean(h));
  if (hexes.length === 0) return [UNKNOWN_FILL];
  return hexes.slice(0, 2);
}

/** Mix a hex color toward black (amount > 0) or white (amount < 0). */
export function shade(hex: string, amount: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const target = amount >= 0 ? 0 : 255;
  const t = Math.min(Math.abs(amount), 1);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * (1 - t) + target * t);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

/** Relative luminance (WCAG) of a hex color, 0 = black, 1 = white. */
export function luminance(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** Font size (mm) so the imprint fits comfortably on the face of the pill. */
export function imprintFontSize(text: string, geo: Pick<PillGeometry, "width" | "height" | "drawn">) {
  const chars = Math.max(text.length, 1);
  const usableWidth = geo.width * (geo.drawn === "capsule" ? 0.4 : 0.62);
  const byWidth = usableWidth / (chars * 0.62); // Atkinson Mono advance ≈ 0.6em
  const byHeight = geo.height * (geo.drawn === "capsule" ? 0.5 : 0.36);
  return r2(Math.min(byWidth, byHeight));
}

/** Capsules carry printed ink imprints; tablets are stamped (debossed) into the surface. */
export function imprintStyle(geo: Pick<PillGeometry, "drawn">): "printed" | "debossed" {
  return geo.drawn === "capsule" ? "printed" : "debossed";
}

/** RxNav SCORE is the number of pieces the tablet breaks into: 1 = no score line. */
export function isScored(score: number | string | undefined | null) {
  const n = Number(score);
  return Number.isFinite(n) && n >= 2;
}

/** "I2" or "44;291" or ["44", "291"] → ["I2"] / ["44", "291"]. */
export function imprintSides(imprint: string | readonly string[] | undefined | null): string[] {
  if (!imprint) return [];
  const list = typeof imprint === "string" ? [imprint] : imprint;
  return list.flatMap((s) => s.split(";")).map((s) => s.trim()).filter(Boolean);
}

/** "10 mm" → 10. Returns null when RxNav gives nothing usable. */
export function parseSizeMm(size: string | number | undefined | null): number | null {
  if (typeof size === "number") return Number.isFinite(size) && size > 0 ? size : null;
  const m = size?.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

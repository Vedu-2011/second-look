import sharp from "sharp";
export async function scene(count: number, options: { background?: string; touching?: boolean; specks?: boolean; width?: number; height?: number; mixed?: boolean } = {}) {
  const width = options.width ?? 1200, height = options.height ?? 1000;
  const ellipses = Array.from({ length: count }, (_, i) => {
    const x = options.touching && i === 1 ? 185 : 130 + (i % 5) * 230;
    const y = 120 + Math.floor(i / 5) * 180;
    return `<ellipse cx="${x}" cy="${y}" rx="42" ry="27" fill="${options.mixed && i % 2 ? "#ce5524" : "#3066b8"}"/>`;
  }).join("");
  const specks = options.specks ? Array.from({ length: 90 }, (_, i) => `<circle cx="${15 + (i * 73) % (width - 30)}" cy="${20 + (i * 79) % (height - 40)}" r="1.5" fill="#cc5500"/>`).join("") : "";
  return sharp(Buffer.from(`<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="${options.background ?? "#f6df89"}"/>${ellipses}${specks}</svg>`)).png().toBuffer();
}
export type ScenePill = { cx: number; cy: number; rx?: number; ry?: number; color?: string; angle?: number; rect?: boolean };
/** Realistic-ish counters: a lighting gradient, light fold lines, a strip of table along one edge, or a busy pattern. */
export async function layout(pills: readonly ScenePill[], options: { width?: number; height?: number; background?: string; gradient?: boolean; folds?: boolean; strip?: string; stripes?: boolean } = {}) {
  const width = options.width ?? 1200, height = options.height ?? 1000, bg = options.background ?? "#2f2f33";
  const defs = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a4a50"/><stop offset="1" stop-color="#1c1c20"/></linearGradient><pattern id="s" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="12" height="24" fill="#d8c070"/><rect x="12" width="12" height="24" fill="#3a5a8a"/></pattern></defs>`;
  const fill = options.stripes ? "url(#s)" : options.gradient ? "url(#g)" : bg;
  const folds = options.folds ? `<path d="M0 ${height * 0.3} L${width} ${height * 0.42}" stroke="#ffffff" stroke-opacity="0.12" stroke-width="3"/><path d="M${width * 0.62} 0 L${width * 0.55} ${height}" stroke="#000000" stroke-opacity="0.25" stroke-width="4"/>` : "";
  const strip = options.strip ? `<rect y="${height * 0.94}" width="${width}" height="${height * 0.06}" fill="${options.strip}"/>` : "";
  const shapes = pills.map((p) => {
    const rx = p.rx ?? 60, ry = p.ry ?? 32, color = p.color ?? "#f2f0ea", turn = `rotate(${p.angle ?? 0} ${p.cx} ${p.cy})`;
    return p.rect ? `<rect x="${p.cx - rx}" y="${p.cy - ry}" width="${2 * rx}" height="${2 * ry}" rx="${ry * 0.3}" fill="${color}" transform="${turn}"/>` : `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${rx}" ry="${ry}" fill="${color}" transform="${turn}"/>`;
  }).join("");
  return sharp(Buffer.from(`<svg width="${width}" height="${height}">${defs}<rect width="100%" height="100%" fill="${fill}"/>${folds}${strip}${shapes}</svg>`)).png().toBuffer();
}
/** A 3 × 3 grid of identical pills, optionally rotated pill by pill. */
export const grid = (over: Partial<ScenePill>[] = [], base: Partial<ScenePill> = {}) => Array.from({ length: 9 }, (_, i) => ({ cx: 230 + (i % 3) * 370, cy: 200 + Math.floor(i / 3) * 290, ...base, ...over[i] }));

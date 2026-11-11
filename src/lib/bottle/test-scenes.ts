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

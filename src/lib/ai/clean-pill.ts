import { normalizeColor } from "../match/color";
/** Preserve readable evidence. Never promote confidence after lossy cleanup. */
export function cleanPillReading(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const raw = input as Record<string, unknown>,
    out = { ...raw };
  let trimmedImprint = false;
  const text = (value: unknown, max: number, onTrim: () => void) => {
    if (typeof value !== "string") return value;
    const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
    if (clean.length > max) onTrim();
    return clean.slice(0, max);
  };
  const lower = (key: string, cap: number) => {
    if (typeof out[key] === "number")
      out[key] = Math.min(out[key] as number, cap);
  };
  if (Array.isArray(raw.imprintSides)) {
    if (raw.imprintSides.length > 4) trimmedImprint = true;
    out.imprintSides = raw.imprintSides
      .slice(0, 4)
      .map((s) =>
        text(s, 40, () => {
          trimmedImprint = true;
        }),
      )
      .filter(
        (s) =>
          typeof s !== "string" ||
          !/^(blank|none|plain|no (visible )?(imprint|markings?|text)|unreadable|illegible|unknown|n\/?a)[.!]?$/i.test(
            s,
          ),
      );
    if (
      (out.imprintSides as unknown[]).some(
        (s) => typeof s === "string" && s.includes("?"),
      )
    )
      trimmedImprint = true;
  }
  if (trimmedImprint) lower("imprintConfidence", 0.69);
  out.shape = text(raw.shape, 30, () => {
    lower("shapeConfidence", 0.49);
    lower("imprintConfidence", 0.69);
  });
  out.form = text(raw.form, 20, () => {
    lower("shapeConfidence", 0.49);
    lower("imprintConfidence", 0.69);
  });
  if (Array.isArray(raw.colors)) {
    const normalized = raw.colors.map((c) =>
      typeof c === "string" ? normalizeColor(c) : null,
    );
    if (normalized.some((c) => !c) || normalized.length > 3) {
      lower("colorConfidence", 0.49);
      lower("imprintConfidence", 0.69);
    }
    out.colors = [...new Set(normalized.filter(Boolean))].slice(0, 3);
  }
  if (raw.guess && typeof raw.guess === "object") {
    const guess = raw.guess as Record<string, unknown>;
    out.guess = {
      ...guess,
      drugName: text(guess.drugName, 120, () => {}),
      strength: text(guess.strength, 40, () => {}),
    };
  }
  return out;
}

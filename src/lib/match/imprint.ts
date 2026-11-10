// Imprint matching: the strongest clue to what a pill is. Pure functions.
//
// FDA imprints (RxNav IMPRINT_CODE) separate sides with ";" ("44;291") and sometimes add descriptor words
// ("Advil;asymmetrical;underline", "logo;M"). A photo usually shows ONE side, so the pill's tokens only need to be
// found among the FDA tokens, in any order.

export type ImprintMatch = "exact" | "close" | "none";

/** Descriptor words the FDA mixes into imprint text. Not things stamped on the pill. No single letters here: "A" can be a real imprint. */
export const IMPRINT_STOPWORDS = new Set([
  "LOGO",
  "UNDERLINE",
  "UNDERLINED",
  "ASYMMETRICAL",
  "SYMMETRICAL",
  "BISECT",
  "BISECTED",
  "SCORE",
  "SCORED",
  "SCORELINE",
  "DEBOSSED",
  "DEBOSS",
  "EMBOSSED",
  "ENGRAVED",
  "PRINTED",
  "IMPRINT",
  "IMPRINTED",
  "SIDE",
  "BLANK",
  "PLAIN",
  "NONE",
  "SYMBOL",
  "IMAGE",
  "DESIGN",
  "AND",
  "THE",
  "WITH",
  "ON",
  "OF",
  "ONE",
  "OTHER",
]);

/** "I-2" / "i 2" / "I.2" → "I2" (one token). */
export function normalizeToken(token: string) {
  return token.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * FDA imprint or pill reading → tokens. Splits sides on ";" and words on spaces/commas, drops descriptor words.
 * Accepts one string or one string per side.
 */
export function tokenizeImprint(raw: string | readonly string[] | null | undefined): string[] {
  if (!raw) return [];
  const sides = typeof raw === "string" ? [raw] : raw;
  return sides
    .flatMap((s) => s.split(/[;,]/))
    .flatMap((side) => {
      const words = side.split(/\s+/).map(normalizeToken).filter(Boolean);
      return words.filter((w) => !IMPRINT_STOPWORDS.has(w));
    });
}

// Characters a camera (or a person) easily mixes up on a tiny stamped pill.
const CONFUSABLE: Record<string, string> = { "0": "O", "1": "I", L: "I", "5": "S", "8": "B", "2": "Z", "6": "G" };

export function foldConfusables(token: string) {
  return [...token].map((c) => CONFUSABLE[c] ?? c).join("");
}

/** True when every pill token is found in the FDA tokens (each FDA token used once). */
function covers(fda: string[], pill: string[]) {
  const pool = [...fda];
  for (const t of pill) {
    const i = pool.indexOf(t);
    if (i === -1) return false;
    pool.splice(i, 1);
  }
  return true;
}

function sameJoined(fda: string[], pill: string[]) {
  // "I 2" read as two tokens vs FDA "I2" (or the other way round).
  const a = fda.join("");
  const b = pill.join("");
  const sort = (xs: string[]) => [...xs].sort().join("");
  return a === b || sort(fda) === sort(pill);
}

function tokensMatch(fda: string[], pill: string[]) {
  return covers(fda, pill) || sameJoined(fda, pill) || (pill.length > 1 && fda.some((f) => f === pill.join("")));
}

export type ImprintComparison = {
  result: ImprintMatch;
  /** The pill showed only some of the FDA sides (normal: a photo shows one side). */
  partial: boolean;
  /** A possible look-alike, not enough evidence for a pass. */
  requiresExact?: true;
};

/** Compare what we read on the pill with an FDA imprint. Side order and separators don't matter. */
export function compareImprint(
  fdaRaw: string | readonly string[] | null | undefined,
  pillRaw: string | readonly string[] | null | undefined,
  fold = true,
): ImprintComparison {
  const fda = tokenizeImprint(fdaRaw);
  const pill = tokenizeImprint(pillRaw);
  if (fda.length === 0 || pill.length === 0) return { result: "none", partial: false };

  const partial = pill.join("").length < fda.join("").length;
  if (tokensMatch(fda, pill)) return { result: "exact", partial };
  if (fold && tokensMatch(fda.map(foldConfusables), pill.map(foldConfusables))) {
    // Phase 6 explicitly retains the complete I2/12 legacy case. It is NOT
    // permission to fold a short side of a longer imprint (e.g. 598;S vs 5).
    const fullI2 = !partial && [fda.join(""), pill.join("")].sort().join("|") === "12|I2";
    const shortFold = [...fda, ...pill].some((t) => t.length <= 2 && fda.includes(t) !== pill.includes(t));
    if (partial || (!fullI2 && shortFold)) return { result: "close", partial, requiresExact: true };
    return { result: "close", partial };
  }
  return { result: "none", partial: false };
}

/** "44;291" → "44 / 291" for display. Descriptor words are left out. */
export function displayImprint(raw: string | readonly string[] | null | undefined) {
  if (!raw) return "";
  const sides = (typeof raw === "string" ? raw.split(";") : [...raw])
    .map((side) =>
      side
        .split(/[\s,]+/)
        .filter((w) => normalizeToken(w) && !IMPRINT_STOPWORDS.has(normalizeToken(w)))
        .join(" "),
    )
    .filter(Boolean);
  return sides.join(" / ");
}

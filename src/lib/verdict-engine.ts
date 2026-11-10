// The verdict engine: AI reads, code decides. Pure function, no network: it gets what was read off the label and
// the pill plus the FDA products the caller looked up, and returns the verdict with every reason in plain words.
import { colorNames, shapeName } from "@/lib/fda/codes";
import { describeConcept, productName } from "@/lib/fda/concept";
import type { DrugConcept, Product } from "@/lib/fda/types";
import { colorsFromCodes, compareColors, normalizeColor, type ColorMatch } from "@/lib/match/color";
import { compareImprint, displayImprint, tokenizeImprint, type ImprintComparison } from "@/lib/match/imprint";
import { compareShapes, normalizeShape, shapeFromCode, type ShapeMatch } from "@/lib/match/shape";
import type { FeatureRow, Verdict } from "@/lib/verdict";

export const IMPRINT_MIN_CONFIDENCE = 0.7;
export const COLOR_MIN_CONFIDENCE = 0.5;
export const SHAPE_MIN_CONFIDENCE = 0.5;

export type LabelReading = {
  ndc?: string | null;
  drugName?: string;
  strength?: string;
  form?: string;
  pharmacyName?: string;
  directions?: string;
  isPrescriptionLabel?: boolean;
  confidence?: { drugName: number; strength: number; ndc: number; form: number };
};

export type PillReading = {
  /** What's printed on the pill, one entry per side we could see. */
  imprintSides: string[];
  imprintConfidence: number;
  colors: string[];
  colorConfidence: number;
  shape: string;
  shapeConfidence: number;
  form?: string;
  /** A lead for code to check, never a conclusion. */
  guess?: { drugName: string; strength?: string } | null;
  pillVisible?: boolean;
  multiplePills?: boolean;
  photoProblems?: string[];
  scored?: boolean;
};

export type EngineData = {
  /** The exact product on the label (from its NDC) */
  labelProduct?: Product | null;
  /** The generic drug the label resolves to (for titles) */
  labelDrug?: DrugConcept | null;
  /** Every product of the same drug + strength, all makers */
  sameDrugProducts: Product[];
  /** Products of the drug the pill reading guessed, if any */
  guessProducts?: Product[];
  /** The label had an NDC we couldn't find */
  labelNdcNotFound?: boolean;
  /** The label's NDC (no dashes) could be more than one real product */
  labelNdcAmbiguous?: boolean;
};

export type Evidence = {
  source: "FDA DailyMed" | "NLM RxNorm";
  role: "label" | "matched" | "identified" | "drug";
  url: string;
  setId?: string;
  rxcui?: string;
};

export type EngineResult = {
  verdict: Verdict;
  /** What the FDA says the label's pill looks like */
  expected: Product | null;
  /** True when the label had no NDC and `expected` is the most common look among all makers */
  expectedIsTypical: boolean;
  /** The FDA product the pill matched (MATCH / SAME_MEDICINE) */
  matchedProduct: Product | null;
  /** MISMATCH only: what the pill actually is, when we could prove it from FDA data */
  identifiedAs: Product | null;
  labelTitle: string | null;
  features: FeatureRow[];
  highlight?: "imprint" | "color" | "shape";
  evidence: Evidence[];
  reasons: string[];
  /** How many FDA products of the label's medicine we compared against */
  productsCompared: number;
};

/** "skipped" = the reading was below its confidence threshold, so we chose not to use it.
 *  "unknown" = we trusted the reading but couldn't compare it (FDA lists no color/shape, or a word we don't know). */
type Scored = {
  product: Product;
  imprint: ImprintComparison;
  color: ColorMatch | "unknown" | "skipped";
  shape: ShapeMatch | "unknown" | "skipped";
};

function score(product: Product, pill: PillReading): Scored {
  const pillColors = pill.colors.map(normalizeColor).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const colorTrusted = pill.colorConfidence >= COLOR_MIN_CONFIDENCE;
  const shapeTrusted = pill.shapeConfidence >= SHAPE_MIN_CONFIDENCE;
  return {
    product,
    imprint: compareImprint(product.imprintRaw, pill.imprintSides),
    color: colorTrusted ? compareColors(colorsFromCodes(product.colorCodes), pillColors) : "skipped",
    shape: shapeTrusted ? compareShapes(shapeFromCode(product.shapeCode), normalizeShape(pill.shape)) : "skipped",
  };
}

const appearanceOk = (s: Scored) => s.color !== "different" && s.shape !== "different";
/** Every appearance reading we trusted was actually compared. Letters alone never give a yes. */
const appearanceChecked = (s: Scored) => s.color !== "unknown" && s.shape !== "unknown";
const usable = (s: Scored) => appearanceOk(s) && appearanceChecked(s);

function rank(s: Scored) {
  return (
    (s.imprint.result === "exact" ? 100 : s.imprint.result === "close" ? 50 : 0) +
    (appearanceOk(s) ? 20 : 0) +
    (appearanceChecked(s) ? 10 : 0) +
    (s.color === "exact" ? 4 : 0) +
    (s.shape === "exact" ? 4 : 0) +
    (s.product.active ? 8 : 0) +
    (s.imprint.partial ? 0 : 2) +
    (s.product.setId ? 1 : 0)
  );
}

function best(list: Scored[]) {
  return [...list].sort((a, b) => rank(b) - rank(a))[0];
}

/** The look most makers use, for labels without an NDC ("most ibuprofen 200 mg tablets are orange, round, I2…"). */
export function mostCommonLook(products: Product[]): { product: Product; count: number } | null {
  const usable = products.filter((p) => p.imprintTokens.length > 0 && p.colorCodes.length > 0 && p.shapeCode);
  const pool = usable.some((p) => p.active) ? usable.filter((p) => p.active) : usable;
  const groups = new Map<string, Product[]>();
  for (const p of pool) {
    const k = [[...p.imprintTokens].sort().join(" "), [...p.colorCodes].sort().join(","), p.shapeCode].join("|");
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  let top: Product[] | null = null;
  for (const g of groups.values()) if (!top || g.length > top.length) top = g;
  if (!top) return null;
  return { product: top.find((p) => p.setId) ?? top[0], count: top.length };
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const colorsText = (colors: string[]) => cap(colors.map((c) => c.trim().toLowerCase()).filter(Boolean).join(" and "));

function featureRows(ref: Scored | null, pill: PillReading, lowImprint: boolean): FeatureRow[] {
  const p = ref?.product;
  const found = {
    imprint: pill.imprintSides.map((s) => s.trim()).filter(Boolean).join(" / ") || "None seen",
    color: colorsText(pill.colors) || "Not seen",
    shape: cap(pill.shape?.trim().toLowerCase() ?? "") || "Not seen",
  };
  const res = (r: "exact" | "close" | "none" | "different" | "unknown" | "skipped", lowConfidence = false): FeatureRow["result"] =>
    lowConfidence || r === "unknown" || r === "skipped" ? "unsure" : r === "none" || r === "different" ? "mismatch" : "match";
  return [
    {
      name: "Imprint",
      expected: p ? displayImprint(p.imprintRaw) || "None listed" : "—",
      found: found.imprint,
      result: ref ? res(ref.imprint.result, lowImprint) : "unsure",
    },
    {
      name: "Color",
      expected: p ? (colorNames(p.colorCodes) ?? "Not listed") : "—",
      found: found.color,
      result: ref ? res(ref.color) : "unsure",
    },
    {
      name: "Shape",
      expected: p ? (shapeName(p.shapeCode) ?? "Not listed") : "—",
      found: found.shape,
      result: ref ? res(ref.shape) : "unsure",
    },
    {
      name: "Size",
      expected: p?.sizeMm ? `${p.sizeMm} mm` : "Not listed",
      found: "Not measured",
      result: "not_measured",
    },
  ];
}

function whatDiffers(s: Scored) {
  const parts = [s.color === "different" && "color", s.shape === "different" && "shape"].filter(Boolean);
  return parts.join(" and ");
}

function whatUnchecked(s: Scored) {
  const parts = [s.color === "unknown" && "color", s.shape === "unknown" && "shape"].filter(Boolean);
  return parts.join(" or ");
}

const maker = (p: Product) => p.labeler ?? "another company";
const titleOf = (p: Product | null | undefined, fallback: string | null) => (p?.title ? productName(p) : (fallback ?? "your medicine"));

export function decide(label: LabelReading, pill: PillReading, data: EngineData): EngineResult {
  const reasons: string[] = [];
  const labelProduct = data.labelProduct ?? null;
  const sameDrug = data.sameDrugProducts;
  const labelTitle = (labelProduct?.title ? productName(labelProduct) : null) ?? describeConcept(data.labelDrug?.name).title ?? label.drugName ?? null;
  const pillText = pill.imprintSides.join(" / ").trim();
  const lowImprint = pill.imprintConfidence < IMPRINT_MIN_CONFIDENCE;

  if (data.labelNdcNotFound) {
    reasons.push(`We couldn't find NDC ${label.ndc} in the FDA's list${labelTitle ? `, so we used the drug name on your label` : ""}.`);
  }
  if (data.labelNdcAmbiguous) {
    reasons.push(
      `NDC ${label.ndc} could belong to more than one product without its dashes, so we used the drug name on your label instead.`,
    );
  }

  // Which product does the FDA say should be in the bottle?
  const typical = labelProduct ? null : mostCommonLook(sameDrug);
  const expected = labelProduct ?? typical?.product ?? null;
  const expectedIsTypical = !labelProduct && Boolean(typical);
  if (expectedIsTypical && typical) {
    reasons.push(
      `Your label doesn't show an NDC, so we compared your pill with all ${sameDrug.length} versions of ${labelTitle ?? "this medicine"} the FDA lists.`,
    );
  }

  const result = (
    verdict: Verdict,
    extra: Partial<Pick<EngineResult, "matchedProduct" | "identifiedAs">> & { ref?: Scored | null } = {},
  ): EngineResult => {
    const ref = extra.ref ?? (expected ? score(expected, pill) : null);
    const features = featureRows(ref, pill, lowImprint);
    const failing = features.find((f) => f.result === "mismatch" && f.name !== "Size");
    const matchedProduct = extra.matchedProduct ?? null;
    const identifiedAs = extra.identifiedAs ?? null;
    if (matchedProduct && !matchedProduct.active) {
      reasons.push("This version is no longer made, but its FDA record still matches your pill.");
    }
    return {
      verdict,
      expected,
      expectedIsTypical,
      matchedProduct,
      identifiedAs,
      labelTitle,
      features,
      highlight: failing ? (failing.name.toLowerCase() as "imprint" | "color" | "shape") : undefined,
      evidence: evidenceFor(verdict, labelProduct ?? expected, matchedProduct, identifiedAs, data.labelDrug),
      reasons,
      productsCompared: sameDrug.length || (labelProduct ? 1 : 0),
    };
  };

  if (!labelProduct && sameDrug.length === 0) {
    reasons.push("We couldn't find the medicine on your label in the FDA's drug list.");
    return result("UNSURE");
  }

  if (tokenizeImprint(pill.imprintSides).length === 0) {
    reasons.push("We couldn't see any letters or numbers on the pill. Most pills have them on one side, so try the other side.");
    return result("UNSURE");
  }

  const lowConfidenceReason = () =>
    reasons.push(`We couldn't read the letters on the pill clearly enough to be sure${pillText ? ` (we think it says ${pillText})` : ""}.`);

  // 1. Is it the exact product on the label?
  if (labelProduct) {
    const own = score(labelProduct, pill);
    if (own.imprint.result !== "none") {
      if (lowImprint) {
        lowConfidenceReason();
        return result("UNSURE", { ref: own });
      }
      if (!appearanceOk(own)) {
        reasons.push(`The letters match ${titleOf(labelProduct, labelTitle)}, but the ${whatDiffers(own)} doesn't. That can mean a mix-up, or just a hard photo.`);
        return result("UNSURE", { ref: own });
      }
      if (!appearanceChecked(own)) {
        reasons.push(uncheckedReason(own, titleOf(labelProduct, labelTitle)));
        return result("UNSURE", { ref: own });
      }
      if (own.imprint.result === "close") reasons.push(closeReason(pillText, labelProduct));
      reasons.push(`The letters, color and shape match the FDA record for ${titleOf(labelProduct, labelTitle)} by ${maker(labelProduct)}.`);
      return result("MATCH", { ref: own, matchedProduct: labelProduct });
    }
  }

  // 2. Another maker's version of the same medicine (or, without an NDC, any version)?
  const others = sameDrug.filter((p) => p.productCode !== labelProduct?.productCode).map((p) => score(p, pill));
  const imprintHits = others.filter((s) => s.imprint.result !== "none");
  const hit = best(imprintHits.filter(usable)) ?? best(imprintHits.filter(appearanceOk)) ?? best(imprintHits);

  if (hit) {
    if (lowImprint) {
      lowConfidenceReason();
      return result("UNSURE", { ref: hit });
    }
    if (!appearanceOk(hit)) {
      reasons.push(`The letters match ${titleOf(hit.product, labelTitle)} by ${maker(hit.product)}, but the ${whatDiffers(hit)} doesn't.`);
      return result("UNSURE", { ref: hit });
    }
    if (!appearanceChecked(hit)) {
      reasons.push(uncheckedReason(hit, `${titleOf(hit.product, labelTitle)} by ${maker(hit.product)}`));
      return result("UNSURE", { ref: hit });
    }
    if (hit.imprint.result === "close") reasons.push(closeReason(pillText, hit.product));
    if (labelProduct) {
      reasons.push(
        `Your label lists ${titleOf(labelProduct, labelTitle)} made by ${maker(labelProduct)}. Your pill matches the FDA record for the version made by ${maker(hit.product)}: same medicine, same strength.`,
      );
      return result("SAME_MEDICINE_DIFFERENT_MAKER", { ref: hit, matchedProduct: hit.product });
    }
    reasons.push(`The letters, color and shape match the FDA record for ${titleOf(hit.product, labelTitle)} by ${maker(hit.product)}.`);
    return result("MATCH", { ref: hit, matchedProduct: hit.product });
  }

  // 3. The imprint isn't on any version of the label's medicine.
  if (lowImprint) {
    lowConfidenceReason();
    return result("UNSURE");
  }
  reasons.push(`No ${labelTitle ?? "version of your medicine"} the FDA lists has "${pillText}" on it. We checked ${sameDrug.length || 1} products from every maker.`);

  const guessHits = (data.guessProducts ?? [])
    .map((p) => score(p, pill))
    .filter((s) => s.imprint.result === "exact");
  const identified = best(guessHits.filter(usable)) ?? best(guessHits.filter(appearanceOk)) ?? best(guessHits);
  if (identified) {
    reasons.push(`"${pillText}" is on ${titleOf(identified.product, null)} made by ${maker(identified.product)} (FDA record).`);
  } else {
    reasons.push("We couldn't confirm what this pill is from FDA records.");
  }
  return result("MISMATCH", { identifiedAs: identified?.product ?? null });
}

function uncheckedReason(s: Scored, what: string) {
  const fdaMissing =
    (s.color === "unknown" && s.product.colorCodes.length === 0) || (s.shape === "unknown" && !s.product.shapeCode);
  return fdaMissing
    ? `The letters match ${what}, but its FDA record doesn't list the ${whatUnchecked(s)}, so we can't confirm the rest.`
    : `The letters match ${what}, but we couldn't tell the pill's ${whatUnchecked(s)} from the photo, so we can't confirm the rest.`;
}

function closeReason(pillText: string, p: Product) {
  return `We read "${pillText}" and the FDA record says "${displayImprint(p.imprintRaw)}". Those characters look alike on a small pill, so we count it as the same.`;
}

const RXNAV_UI = (rxcui: string) => `https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=${encodeURIComponent(rxcui)}`;
const DAILYMED_UI = (setId: string) => `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${encodeURIComponent(setId)}`;

function evidenceFor(
  verdict: Verdict,
  label: Product | null,
  matched: Product | null,
  identified: Product | null,
  labelDrug: DrugConcept | null | undefined,
): Evidence[] {
  const out: Evidence[] = [];
  const seen = new Set<string>();
  const add = (p: Product | null, role: Evidence["role"]) => {
    if (!p?.setId || seen.has(p.setId)) return;
    seen.add(p.setId);
    out.push({ source: "FDA DailyMed", role, setId: p.setId, url: DAILYMED_UI(p.setId) });
  };
  add(label, "label");
  add(matched, "matched");
  add(identified, "identified");
  const rxcui = labelDrug?.rxcui ?? matched?.rxcui ?? label?.rxcui;
  if (rxcui && (verdict === "SAME_MEDICINE_DIFFERENT_MAKER" || verdict === "MATCH" || verdict === "MISMATCH")) {
    out.push({ source: "NLM RxNorm", role: "drug", rxcui, url: RXNAV_UI(rxcui) });
  }
  return out;
}

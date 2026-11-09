// Parsing RxNav ndcproperties JSON into Products. Pure (no network), so tests and /samples can use it directly.
import { tokenizeImprint } from "@/lib/match/imprint";
import { parseSizeMm } from "@/lib/pill";
import { splitCodes } from "./codes";
import { describeConcept } from "./concept";
import { productCodeOf } from "./ndc";
import type { DrugConcept, Product } from "./types";

type RawProperty = {
  ndc9?: string;
  ndc10?: string;
  rxcui?: string;
  splSetIdItem?: string;
  propertyConceptList?: { propertyConcept?: { propName: string; propValue: string }[] };
};

const INACTIVE = new Set(["COMPLETED", "DROPPED", "INACTIVE", "DISCONTINUED", "EXPIRED"]);

/** Raw ndcproperties JSON → one Product per product code (RxNav repeats rows per package size). */
export function parseNdcProperties(json: unknown, concepts: Record<string, DrugConcept> = {}): Product[] {
  const rows = ((json as { ndcPropertyList?: { ndcProperty?: RawProperty[] } })?.ndcPropertyList?.ndcProperty ?? []) as RawProperty[];
  const byCode = new Map<string, Product>();
  for (const row of rows) {
    if (!row.ndc9 || !row.rxcui) continue;
    const code = productCodeOf(row.ndc9);
    if (!code) continue;
    const props: Record<string, string> = {};
    const colorValues: string[] = [];
    for (const p of row.propertyConceptList?.propertyConcept ?? []) {
      if (p.propName === "COLOR") colorValues.push(p.propValue);
      else props[p.propName] ??= p.propValue;
    }
    const status = props.MARKETING_STATUS?.toUpperCase();
    const { title, brand } = describeConcept(concepts[row.rxcui]?.name);
    const product: Product = {
      ndc9: row.ndc9,
      productCode: code,
      ndc10: row.ndc10,
      rxcui: row.rxcui,
      setId: row.splSetIdItem || undefined,
      labeler: props.LABELER,
      title,
      brand,
      imprintRaw: props.IMPRINT_CODE ?? "",
      imprintTokens: tokenizeImprint(props.IMPRINT_CODE ?? ""),
      colorCodes: splitCodes(colorValues),
      colorText: props.COLORTEXT,
      shapeCode: props.SHAPE,
      sizeMm: parseSizeMm(props.SIZE),
      scored: Number(props.SCORE) >= 2,
      marketingStatus: status,
      active: !status || !INACTIVE.has(status),
    };
    const prev = byCode.get(code);
    // Keep the row with the most appearance data (some package rows come without it).
    const richness = (p: Product) => (p.imprintRaw ? 4 : 0) + (p.colorCodes.length ? 2 : 0) + (p.shapeCode ? 1 : 0) + (p.active ? 1 : 0);
    if (!prev || richness(product) > richness(prev)) byCode.set(code, product);
  }
  return [...byCode.values()];
}

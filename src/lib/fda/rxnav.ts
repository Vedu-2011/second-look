// NLM RxNav (https://lhncbc.nlm.nih.gov/RxNav/APIs/) — free, no key. Every lookup is cached (see cache.ts).
import { cached } from "./cache";
import { describeConcept } from "./concept";
import { fetchJson } from "./http";
import { ndcCandidates } from "./ndc";
import { parseNdcProperties } from "./rxnav-parse";
import type { DrugConcept, Product } from "./types";

export const RXNAV = "https://rxnav.nlm.nih.gov/REST";

export { describeConcept, parseNdcProperties };

const DRUG_TTYS = new Set(["SCD", "SBD"]);

export async function conceptProperties(rxcui: string): Promise<DrugConcept | null> {
  const url = `${RXNAV}/rxcui/${encodeURIComponent(rxcui)}/properties.json`;
  return cached(url, async () => {
    const json = (await fetchJson(url)) as { properties?: { rxcui: string; name: string; tty: string } };
    const p = json?.properties;
    return p ? { rxcui: p.rxcui, name: p.name, tty: p.tty } : null;
  });
}

export async function relatedConcepts(rxcui: string, tty: string): Promise<DrugConcept[]> {
  const url = `${RXNAV}/rxcui/${encodeURIComponent(rxcui)}/related.json?tty=${tty}`;
  return cached(url, async () => {
    const json = (await fetchJson(url)) as {
      relatedGroup?: { conceptGroup?: { conceptProperties?: { rxcui: string; name: string; tty: string }[] }[] };
    };
    return (json?.relatedGroup?.conceptGroup ?? [])
      .flatMap((g) => g.conceptProperties ?? [])
      .map((c) => ({ rxcui: c.rxcui, name: c.name, tty: c.tty }));
  });
}

/**
 * Best drug concept (generic SCD or branded SBD) for a typed or read name, e.g. "ibuprofen 200 mg tablet".
 * RxNav returns bare ingredient+strength concepts unless the form is in the term, so callers should include it.
 */
export async function approximateTerm(term: string): Promise<DrugConcept | null> {
  const q = term.trim().replace(/\s+/g, " ");
  if (!q) return null;
  const url = `${RXNAV}/approximateTerm.json?term=${encodeURIComponent(q)}&maxEntries=8`;
  const ids = await cached(url, async () => {
    const json = (await fetchJson(url)) as { approximateGroup?: { candidate?: { rxcui: string }[] } };
    return [...new Set((json?.approximateGroup?.candidate ?? []).map((c) => c.rxcui))].slice(0, 4);
  });
  for (const id of ids) {
    const concept = await conceptProperties(id);
    if (concept && DRUG_TTYS.has(concept.tty)) return concept;
  }
  return null;
}

export function drugTerm({ drugName, strength, form }: { drugName?: string; strength?: string; form?: string }) {
  if (!drugName?.trim()) return null;
  // RxNorm's approximate match needs "oral tablet" for a plain tablet, or it returns the ingredient, not the product.
  // Any other form ("chewable tablet", "oral suspension") is passed through as the label says it.
  const f = form?.trim().toLowerCase() ?? "";
  const formWords = !f || /^(tablet|tab|tablets)$/.test(f) ? "oral tablet" : /^(capsule|cap|capsules)$/.test(f) ? "oral capsule" : f;
  const name = drugName.trim();
  const already = /tablet|capsule|solution|suspension|syrup|cream|patch|injection/i.test(`${name} ${strength ?? ""}`);
  return [name, strength?.trim(), already ? "" : formWords].filter(Boolean).join(" ");
}

/** Every product (all makers, all package sizes merged) for one RxNorm concept. Cached slim. */
export async function productsByRxcui(rxcui: string, concept?: DrugConcept | null): Promise<Product[]> {
  const url = `${RXNAV}/ndcproperties.json?id=${encodeURIComponent(rxcui)}&ndcstatus=ALL`;
  const c = concept ?? (await conceptProperties(rxcui));
  return cached(url, async () => parseNdcProperties(await fetchJson(url), c ? { [rxcui]: c } : {}));
}

export type NdcLookup = {
  product: Product | null;
  /** An undashed NDC that could be more than one real product, so we won't guess which. */
  ambiguous: boolean;
};

/** The exact product printed on a label. An undashed 10-digit NDC can be read three ways: we try each, and only
 *  accept the answer when exactly one of them is a real product. */
export async function lookupNdc(ndcInput: string): Promise<NdcLookup> {
  const found = (
    await Promise.all(
      ndcCandidates(ndcInput).map(async (cand) => {
        const url = `${RXNAV}/ndcproperties.json?id=${cand.productCode}&ndcstatus=ALL`;
        const products = await cached(url, async () => parseNdcProperties(await fetchJson(url)));
        return products.find((p) => p.productCode === cand.productCode) ?? null;
      }),
    )
  ).filter((p): p is Product => Boolean(p));
  if (found.length !== 1) return { product: null, ambiguous: found.length > 1 };
  const concept = await conceptProperties(found[0].rxcui);
  const { title, brand } = describeConcept(concept?.name);
  return { product: { ...found[0], title, brand }, ambiguous: false };
}

export async function productByNdc(ndcInput: string): Promise<Product | null> {
  return (await lookupNdc(ndcInput)).product;
}

export type DrugGroup = {
  /** The generic drug + strength + form (SCD) */
  generic: DrugConcept;
  /** The generic plus every brand of it */
  members: DrugConcept[];
  products: Product[];
};

/**
 * Same medicine, same strength, every maker: the generic concept plus all its brands
 * (e.g. Advil 200 mg tablet → ibuprofen 200 mg tablet → Advil, Motrin, store brands…).
 */
export async function drugGroup(rxcui: string): Promise<DrugGroup | null> {
  const concept = await conceptProperties(rxcui);
  if (!concept) return null;
  let generic = concept;
  if (concept.tty !== "SCD") {
    const scd = (await relatedConcepts(rxcui, "SCD"))[0];
    if (scd) generic = scd;
  }
  const brands = generic.tty === "SCD" ? await relatedConcepts(generic.rxcui, "SBD") : [];
  const members = [generic, ...brands];
  if (!members.some((m) => m.rxcui === concept.rxcui)) members.push(concept);

  const lists = await Promise.all(members.map((m) => productsByRxcui(m.rxcui, m)));
  const seen = new Set<string>();
  const products = lists.flat().filter((p) => (seen.has(p.productCode) ? false : (seen.add(p.productCode), true)));
  return { generic, members, products };
}

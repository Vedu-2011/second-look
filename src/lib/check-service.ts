// Server side: looks up the FDA data a check needs, then lets the pure verdict engine decide.
import { labelMeta } from "@/lib/fda/dailymed";
import { approximateTerm, drugGroup, drugTerm, lookupNdc } from "@/lib/fda/rxnav";
import type { DrugConcept, LabelMeta, Product } from "@/lib/fda/types";
import { decide, type EngineData, type EngineResult, type LabelReading, type PillReading } from "@/lib/verdict-engine";

import { listingEvidence, type ListingEvidence } from './listing-evidence';

export type CheckResult = EngineResult & {
  matchingListings?: ListingEvidence | null;
  identifiedListings?: ListingEvidence | null;
  label: LabelReading;
  pill: PillReading;
  /** The exact product on the label, when it had an NDC we found */
  labelProduct: Product | null;
  /** DailyMed title + published date for every label we cite, by setId */
  labels: Record<string, LabelMeta>;
  checkedAt: string;
  timings: { label: number; drug: number; guess: number; dailymed: number; total: number };
};

const ms = (start: number) => Math.round(performance.now() - start);

async function resolveDrug(label: LabelReading): Promise<DrugConcept | null> {
  const term = drugTerm(label);
  return term ? approximateTerm(term) : null;
}

export async function runCheck(label: LabelReading, pill: PillReading): Promise<CheckResult> {
  const t0 = performance.now();
  const timings = { label: 0, drug: 0, guess: 0, dailymed: 0, total: 0 };

  // 1. The label: exact product from the NDC, else the drug from its name.
  let t = performance.now();
  const ndc = label.ndc?.trim() ? await lookupNdc(label.ndc) : null;
  const labelProduct = ndc?.product ?? null;
  const labelNdcAmbiguous = Boolean(ndc?.ambiguous);
  const labelNdcNotFound = Boolean(ndc) && !labelProduct && !labelNdcAmbiguous;
  const rxcui = labelProduct?.rxcui ?? (await resolveDrug(label))?.rxcui ?? null;
  timings.label = ms(t);

  // 2. Every maker's version of that medicine + strength.
  t = performance.now();
  const group = rxcui ? await drugGroup(rxcui) : null;
  timings.drug = ms(t);

  const data: EngineData = {
    labelProduct,
    labelDrug: group?.generic ?? null,
    sameDrugProducts: group?.products ?? [],
    labelNdcNotFound,
    labelNdcAmbiguous,
  };
  let result = decide(label, pill, data);
  let guessProducts: Product[] = [];

  // 3. Doesn't match: check the reader's guess against FDA data to say what the pill really is.
  if (result.verdict === "MISMATCH" && pill.guess?.drugName) {
    t = performance.now();
    const guessDrug = await resolveDrug({ drugName: pill.guess.drugName, strength: pill.guess.strength, form: pill.form });
    if (guessDrug) {
      const guessGroup = await drugGroup(guessDrug.rxcui);
      if (guessGroup && guessGroup.generic.rxcui !== group?.generic.rxcui) {
        guessProducts = guessGroup.products;
        result = decide(label, pill, { ...data, guessProducts });
      }
    }
    timings.guess = ms(t);
  }

  // 4. Label titles and published dates for every FDA record we cite.
  t = performance.now();
  const setIds = result.evidence.flatMap((e) => (e.setId ? [e.setId] : []));
  const metas = await Promise.all(setIds.map((id) => labelMeta(id).catch(() => null)));
  timings.dailymed = ms(t);
  timings.total = ms(t0);

  return {
    ...result,
    matchingListings: listingEvidence(result.matchedProduct, data.sameDrugProducts, labelProduct?.productCode),
    identifiedListings: listingEvidence(result.identifiedAs, guessProducts, labelProduct?.productCode),
    label,
    pill,
    labelProduct,
    labels: Object.fromEntries(metas.filter((m): m is LabelMeta => Boolean(m)).map((m) => [m.setId, m])),
    checkedAt: new Date().toISOString(),
    timings,
  };
}

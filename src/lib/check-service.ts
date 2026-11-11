// Server side: looks up the FDA data a check needs, then lets the pure verdict engine decide.
import { labelMeta } from "@/lib/fda/dailymed";
import { approximateTerm, drugGroup, drugTerm, lookupNdc } from "@/lib/fda/rxnav";
import type { DrugConcept, LabelMeta, Product } from "@/lib/fda/types";
import { decide, type EngineData, type EngineResult, type LabelReading, type PillReading } from "@/lib/verdict-engine";

import { listingEvidence, type ListingEvidence } from './listing-evidence';
import { recordedLead } from './recorded-lead';

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

export async function resolveLabelData(label: LabelReading) {
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
  return { data, group, timings, guesses: new Map<string, Promise<Product[]>>(), metas: new Map<string, Promise<LabelMeta | null>>() };
}

export type ResolvedLabelData = Awaited<ReturnType<typeof resolveLabelData>>;

/** Reuses exactly the same expected FDA data for every pill; engine behavior is unchanged. */
export async function runResolvedCheck(label: LabelReading, pill: PillReading, resolved: ResolvedLabelData): Promise<CheckResult> {
  const t0 = performance.now();
  const { data, group } = resolved;
  const labelProduct = data.labelProduct ?? null;
  const timings = { ...resolved.timings };
  let t = performance.now();
  let result = decide(label, pill, data);
  let guessProducts: Product[] = [];

  // 3. Doesn't match: check a lead against FDA data to say what the pill really is. The lead is the reader's
  // guess, else our recorded FDA imprint index: a flip merges two photos, and neither photo alone shows enough
  // to guess from. Either way the lead only names a candidate; the engine re-checks the whole imprint.
  const lead = pill.guess?.drugName ? pill.guess : recordedLead(pill);
  if (result.verdict === "MISMATCH" && lead?.drugName) {
    t = performance.now();
    const guessLabel = { drugName: lead.drugName, strength: lead.strength, form: pill.form };
    const cacheKey = drugTerm(guessLabel) ?? "";
    let pending = resolved.guesses.get(cacheKey);
    if (!pending) {
      pending = (async () => {
        const drug = await resolveDrug(guessLabel);
        const guessed = drug ? await drugGroup(drug.rxcui) : null;
        return guessed && guessed.generic.rxcui !== group?.generic.rxcui ? guessed.products : [];
      })();
      resolved.guesses.set(cacheKey, pending);
    }
    guessProducts = await pending;
    if (guessProducts.length) result = decide(label, pill, { ...data, guessProducts });
    timings.guess = ms(t);
  }

  // 4. Label titles and published dates for every FDA record we cite.
  t = performance.now();
  const setIds = result.evidence.flatMap((e) => (e.setId ? [e.setId] : []));
  const metas = await Promise.all([...new Set(setIds)].map((id) => {
    if (!resolved.metas.has(id)) resolved.metas.set(id, labelMeta(id).catch(() => null));
    return resolved.metas.get(id)!;
  }));
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

export async function runCheck(label: LabelReading, pill: PillReading): Promise<CheckResult> {
  const start = performance.now();
  const result = await runResolvedCheck(label, pill, await resolveLabelData(label));
  result.timings.total = ms(start);
  return result;
}

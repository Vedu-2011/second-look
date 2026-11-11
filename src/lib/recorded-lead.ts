import real from "./fda/__fixtures__/real-demo.json";
import { CONCEPTS, RECORDED } from "@/lib/fda/recorded";
import { compareImprint } from "@/lib/match/imprint";
import type { PillReading } from "@/lib/verdict-engine";

/** A lead from our recorded FDA index, always verified again against live same-drug products by runCheck. */
export function recordedLead(pill: PillReading) {
  if (pill.imprintConfidence < 0.7) return null;
  const groups = [
    { products: [...RECORDED.acetaminophen500Products, ...real.groups["209459"].products], concept: CONCEPTS.acetaminophen500 },
    { products: RECORDED.ibuprofen200Products, concept: CONCEPTS.ibuprofen200 },
    { products: real.groups["310964"].products, concept: real.groups["310964"].generic },
    { products: real.groups["861004"].products, concept: real.groups["861004"].generic },
    { products: real.groups["308192"].products, concept: real.groups["308192"].generic },
  ];
  const matches = groups.filter(g => g.products.some(p => compareImprint(p.imprintRaw, pill.imprintSides).result === "exact"));
  if (matches.length !== 1) return null;
  const concept = matches[0].concept;
  return { drugName: concept.name, strength: undefined };
}

// Real RxNav data recorded on the date in __fixtures__/index.json (scripts/record-fda-fixtures.mjs).
// Used by the network-free tests and by /samples, which runs the real verdict engine on it.
import ndc005730160 from "./__fixtures__/ndcproperties-005730160.json";
import ndc001130517 from "./__fixtures__/ndcproperties-001130517.json";
import rx198440 from "./__fixtures__/ndcproperties-198440.json";
import rx310965 from "./__fixtures__/ndcproperties-310965.json";
import props153008 from "./__fixtures__/properties-153008.json";
import props198440 from "./__fixtures__/properties-198440.json";
import props310965 from "./__fixtures__/properties-310965.json";
import index from "./__fixtures__/index.json";
import { describeConcept } from "./concept";
import { parseNdcProperties } from "./rxnav-parse";
import type { DrugConcept, Product } from "./types";

const concept = (j: { properties: DrugConcept }): DrugConcept => ({
  rxcui: j.properties.rxcui,
  name: j.properties.name,
  tty: j.properties.tty,
});

export const RECORDED_ON: string = index.recordedOn;

export const CONCEPTS = {
  ibuprofen200: concept(props310965),
  advil200: concept(props153008),
  acetaminophen500: concept(props198440),
};

const withTitle = (p: Product, c: DrugConcept): Product => {
  const { title, brand } = describeConcept(c.name);
  return { ...p, title, brand };
};

export const RECORDED = {
  ibuprofen200Products: parseNdcProperties(rx310965, { "310965": CONCEPTS.ibuprofen200 }),
  acetaminophen500Products: parseNdcProperties(rx198440, { "198440": CONCEPTS.acetaminophen500 }),
  perrigoI2Oval: withTitle(parseNdcProperties(ndc001130517)[0], CONCEPTS.ibuprofen200),
  advilOval: withTitle(parseNdcProperties(ndc005730160)[0], CONCEPTS.advil200),
};

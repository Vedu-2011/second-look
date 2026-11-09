// Records trimmed REAL RxNav responses for the network-free tests (src/lib/fda/__fixtures__/).
// Trimming: one row per product code (RxNav repeats rows per package size) and no packagingList. Nothing else is changed.
// Run: node scripts/record-fda-fixtures.mjs
import { writeFileSync } from "node:fs";

const RX = "https://rxnav.nlm.nih.gov/REST";
const OUT = new URL("../src/lib/fda/__fixtures__/", import.meta.url);
const recordedOn = new Date().toISOString().slice(0, 10);

const trimNdc = (json) => {
  const rows = json?.ndcPropertyList?.ndcProperty ?? [];
  const seen = new Set();
  const kept = rows.filter((r) => (seen.has(r.ndc9) ? false : seen.add(r.ndc9))).map((r) => {
    const rest = { ...r };
    delete rest.packagingList;
    return rest;
  });
  return { ndcPropertyList: kept.length ? { ndcProperty: kept } : null };
};

const items = [
  ["ndcproperties-310965", `${RX}/ndcproperties.json?id=310965&ndcstatus=ALL`, trimNdc],
  ["ndcproperties-198440", `${RX}/ndcproperties.json?id=198440&ndcstatus=ALL`, trimNdc],
  ["ndcproperties-005730160", `${RX}/ndcproperties.json?id=005730160&ndcstatus=ALL`, trimNdc],
  ["ndcproperties-001130517", `${RX}/ndcproperties.json?id=001130517&ndcstatus=ALL`, trimNdc],
  ["properties-310965", `${RX}/rxcui/310965/properties.json`],
  ["properties-153008", `${RX}/rxcui/153008/properties.json`],
  ["properties-198440", `${RX}/rxcui/198440/properties.json`],
  ["related-153008-SCD", `${RX}/rxcui/153008/related.json?tty=SCD`],
  ["related-310965-SBD", `${RX}/rxcui/310965/related.json?tty=SBD`],
  ["related-198440-SBD", `${RX}/rxcui/198440/related.json?tty=SBD`],
  ["approximate-ibuprofen", `${RX}/approximateTerm.json?term=${encodeURIComponent("Ibuprofen 200 mg oral tablet")}&maxEntries=8`],
  ["approximate-acetaminophen", `${RX}/approximateTerm.json?term=${encodeURIComponent("acetaminophen 500 mg oral tablet")}&maxEntries=8`],
];

const index = {};
for (const [name, url, trim] of items) {
  const json = await (await fetch(url)).json();
  writeFileSync(new URL(`${name}.json`, OUT), JSON.stringify(trim ? trim(json) : json));
  index[name] = url;
  console.log(name, "ok");
}
// DailyMed titles + published dates for the labels the samples cite.
const DM = "https://dailymed.nlm.nih.gov/dailymed/services/v2";
const setIds = [
  "aebae4b3-18c8-4ecf-b578-1fe7cc50076b", // ibuprofen 200 mg, Perrigo (I2 oval)
  "1a665e64-9f30-be37-4a83-38789f1f1e89", // Advil
  "7f78028a-484b-48b3-a37a-1e0b055bbefc", // acetaminophen 500 mg, Perrigo (L484)
  "70d0a429-27c1-43a5-b2ea-a9919e0910f8", // most common ibuprofen 200 mg look
];
const labels = {};
for (const id of setIds) {
  const json = await (await fetch(`${DM}/spls.json?setid=${id}`)).json();
  labels[id] = json.data?.[0] ?? null;
}
writeFileSync(new URL("dailymed-labels.json", OUT), JSON.stringify(labels, null, 2));
index["dailymed-labels"] = `${DM}/spls.json?setid=<setid>`;
console.log("dailymed-labels ok");

writeFileSync(new URL("index.json", OUT), JSON.stringify({ recordedOn, note: "Trimmed real RxNav responses: one row per product code, packagingList removed.", files: index }, null, 2));

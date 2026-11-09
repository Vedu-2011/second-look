// Real FDA product records, pulled live from NLM RxNav on Nov 8, 2026 and hardcoded here for the
// /style gallery and sample cards. Nothing here is made up: every value is copied from the source URL.
//
//   RxNav:    https://rxnav.nlm.nih.gov/REST/ndcproperties.json?id=<ndc>
//   DailyMed: https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?setid=<setid>
//
// Phase 1 replaces these with live, cached lookups.

export type FdaProduct = {
  id: string;
  drug: string;
  strength: string;
  labeler: string;
  ndc: string;
  rxcui: string;
  setid: string;
  /** DailyMed published date of the current label version. */
  publishedDate: string;
  /** RxNav IMPRINT_CODE split on ";" (one entry per side). */
  imprintSides: string[];
  /** RxNav COLOR, split on ";". */
  colorCodes: string[];
  colorText: string;
  shapeCode: string;
  sizeMm: number;
  /** RxNav SCORE: 1 = not scored, 2 = one score line. */
  score: number;
  marketingStatus: string;
  sourceUrl: string;
};

const rxnav = (ndc: string) => `https://rxnav.nlm.nih.gov/REST/ndcproperties.json?id=${ndc}`;

export const IBUPROFEN_I2_ROUND: FdaProduct = {
  id: "ibuprofen-i2-round",
  drug: "Ibuprofen",
  strength: "200 mg",
  labeler: "L. Perrigo Company",
  ndc: "0113-0074",
  rxcui: "310965",
  setid: "19239a12-d915-40b3-8a6a-e326d3c733c6",
  // This product's marketing is "COMPLETED" (discontinued); its last DailyMed version is from Feb 24, 2025
  // and it no longer appears in the current DailyMed SPL list (the drugInfo page still opens).
  publishedDate: "2025-02-24",
  imprintSides: ["I2"],
  colorCodes: ["C48331"],
  colorText: "ORANGE",
  shapeCode: "C48348",
  sizeMm: 10,
  score: 1,
  marketingStatus: "COMPLETED",
  sourceUrl: rxnav("0113-0074"),
};

export const IBUPROFEN_I2_OVAL: FdaProduct = {
  id: "ibuprofen-i2-oval",
  drug: "Ibuprofen",
  strength: "200 mg",
  labeler: "L. Perrigo Company",
  ndc: "0113-0517",
  rxcui: "310965",
  setid: "aebae4b3-18c8-4ecf-b578-1fe7cc50076b",
  publishedDate: "2026-08-06",
  imprintSides: ["I2"],
  colorCodes: ["C48331"],
  colorText: "ORANGE",
  shapeCode: "C48345",
  sizeMm: 15,
  score: 1,
  marketingStatus: "ACTIVE",
  sourceUrl: rxnav("0113-0517"),
};

export const ADVIL_OVAL: FdaProduct = {
  id: "advil-oval",
  drug: "Advil (ibuprofen)",
  strength: "200 mg",
  labeler: "Haleon US Holdings LLC",
  ndc: "0573-0165",
  rxcui: "153008",
  setid: "1a665e64-9f30-be37-4a83-38789f1f1e89",
  publishedDate: "2026-11-06",
  imprintSides: ["Advil"],
  colorCodes: ["C48332"],
  // The FDA color code is just brown; the label's free text adds the detail.
  colorText: "brown (one side is brown while the other side is yellow)",
  shapeCode: "C48345",
  sizeMm: 16,
  score: 1,
  marketingStatus: "ACTIVE",
  sourceUrl: rxnav("0573-0165"),
};

export const ACETAMINOPHEN_L484: FdaProduct = {
  id: "acetaminophen-l484",
  drug: "Acetaminophen",
  strength: "500 mg",
  labeler: "L. Perrigo Company",
  ndc: "0113-0484",
  rxcui: "198440",
  setid: "7f78028a-484b-48b3-a37a-1e0b055bbefc",
  publishedDate: "2025-11-25",
  imprintSides: ["L484"],
  colorCodes: ["C48325"],
  colorText: "WHITE",
  shapeCode: "C48345",
  sizeMm: 16,
  score: 1,
  marketingStatus: "ACTIVE",
  sourceUrl: rxnav("0113-0484"),
};

export const OMEPRAZOLE_CAPSULE: FdaProduct = {
  id: "omeprazole-capsule",
  drug: "Omeprazole delayed release",
  strength: "20 mg",
  labeler: "L. Perrigo Company",
  ndc: "0113-6010",
  rxcui: "198051",
  setid: "b840439b-540b-465a-8faa-f7b1024c628e",
  publishedDate: "2026-07-08",
  imprintSides: ["57S"],
  colorCodes: ["C48325", "C48331"],
  colorText: "WHITE,ORANGE",
  shapeCode: "C48336",
  sizeMm: 14,
  score: 1,
  marketingStatus: "ACTIVE",
  sourceUrl: rxnav("0113-6010"),
};

export const FIXTURES = [
  IBUPROFEN_I2_ROUND,
  IBUPROFEN_I2_OVAL,
  ADVIL_OVAL,
  ACETAMINOPHEN_L484,
  OMEPRAZOLE_CAPSULE,
];

export function dailyMedUrl(setid: string) {
  return `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setid}`;
}

/** "2026-11-06" → "Nov 6, 2026" (fixed to UTC so server and browser agree). */
export function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

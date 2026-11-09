// What we keep from RxNav for each product (one per 9-digit product code, all package sizes merged).

export type DrugConcept = {
  rxcui: string;
  /** RxNorm name, e.g. "ibuprofen 200 MG Oral Tablet [Advil]" */
  name: string;
  /** SCD = generic clinical drug, SBD = branded drug */
  tty: string;
};

export type Product = {
  /** RxNav's own spelling, e.g. "0573-0160" */
  ndc9: string;
  /** 9-digit product code, e.g. "005730160" */
  productCode: string;
  ndc10?: string;
  rxcui: string;
  setId?: string;
  labeler?: string;
  /** "Ibuprofen 200 mg" from the RxNorm concept name */
  title?: string;
  brand?: string;
  imprintRaw: string;
  imprintTokens: string[];
  /** FDA color codes, packed values already split: ["C48325", "C48331"] */
  colorCodes: string[];
  colorText?: string;
  shapeCode?: string;
  sizeMm: number | null;
  /** RxNav SCORE is the number of pieces: "1" = not scored */
  scored: boolean;
  marketingStatus?: string;
  /** false when the FDA lists it as no longer marketed */
  active: boolean;
};

export type LabelMeta = {
  setId: string;
  title: string | null;
  /** ISO date of the current (or last) label version */
  publishedDate: string | null;
  url: string;
  /** false when DailyMed no longer lists the label (product discontinued) */
  current: boolean;
};

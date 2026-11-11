export const LABEL_IDS = ["match", "different-maker", "mismatch"] as const;
export type LabelId = typeof LABEL_IDS[number];
export type LabelParams = Record<string, string | string[] | undefined>;
export type DemoLabel = { id: LabelId; scenario: string; pharmacy: string; patient: string; rx: string; drug: string; strength: string; form: string; directions: string; qty: string; ndc: string; mfr: string; date: string; initials: string };

/** Global params affect all labels; match.ndc etc. override one label. Text is rendered by React, never HTML. */
export function demoLabels(params: LabelParams = {}): DemoLabel[] {
  return LABEL_IDS.map((id, i) => {
    // Addendum 3: match + mismatch (and the whole-bottle demo) use the metformin label; same-medicine uses Advil.
    const advil = id === "different-maker";
    const defaults: DemoLabel = { id, scenario: ["The right pill", "Same medicine, new look", "The wrong pill"][i], pharmacy: "Maple Street Pharmacy", patient: "Alex Rivera", rx: `20481${i + 1}`, drug: advil ? "Advil Liqui-Gels (ibuprofen)" : "Metformin", strength: advil ? "200 mg" : "1,000 mg", form: advil ? "capsule" : "tablet", directions: advil ? "Use only as directed on the original package." : "Take as directed by your prescriber.", qty: "30", ndc: advil ? "0573-0169" : "70010-065", mfr: advil ? "Haleon" : "Granules", date: "11/10/2026", initials: "JL" };
    for (const field of Object.keys(defaults) as (keyof DemoLabel)[]) {
      if (field === "id" || field === "scenario") continue;
      const value = params[`${id}.${field}`] ?? params[field];
      const scalar = Array.isArray(value) ? value[0] : value;
      if (scalar?.trim()) defaults[field] = scalar.trim().slice(0, field === "directions" ? 160 : 80);
    }
    return defaults;
  });
}

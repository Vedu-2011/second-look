// Phase 12: up to three photos of one label (it wraps around the bottle). Each photo is read on its own with the
// existing label reader; this merges them field by field. Code decides, never the AI: a field comes only from a
// confident reading, two confident readings that disagree on the drug, strength or NDC are a conflict for the person
// to settle (never guessed), and nothing is filled in that no photo showed. One photo merges to exactly its reading.
import type { LabelReading } from "@/lib/verdict-engine";

export const KEY_FIELDS = ["drugName", "strength", "ndc"] as const;
export type KeyField = (typeof KEY_FIELDS)[number];
export const MAX_LABEL_PHOTOS = 3;
/** The same bar the single-photo check uses before it trusts a drug name. */
export const CONFIDENT = 0.55;
export type LabelConflict = { field: KeyField; options: { value: string; photos: number[] }[] };
export type MergedLabel = { label: LabelReading; conflicts: LabelConflict[]; missing: KeyField[] };
export type LabelChoices = Partial<Record<KeyField, number>>;

const FIELD_WORDS: Record<KeyField, string> = { drugName: "medicine name", strength: "strength", ndc: "NDC" };
export const fieldWord = (f: KeyField) => FIELD_WORDS[f];
const confidenceOf = (r: LabelReading, f: KeyField | "form") => r.confidence?.[f] ?? 1;
const tokens = (s: string) => s.toLowerCase().replace(/\bhcl\b/g, "hydrochloride").split(/[^a-z0-9]+/).filter(Boolean);
const milligrams = (s: string) => {
  const m = s.toLowerCase().replace(/,/g, "").match(/^\s*(\d+(?:\.\d+)?)\s*(mcg|mg|g)\s*$/);
  return m ? Number(m[1]) * (m[2] === "g" ? 1000 : m[2] === "mcg" ? 0.001 : 1) : null;
};
/** Two readings of one field that can both be true of the same label (one may just be more complete). */
function compatible(field: KeyField, a: string, b: string) {
  if (field === "ndc") { const x = a.replace(/\D/g, ""), y = b.replace(/\D/g, ""); return Boolean(x && y) && (x.startsWith(y) || y.startsWith(x)); }
  if (field === "strength") { const x = milligrams(a), y = milligrams(b); if (x !== null && y !== null) return x === y; }
  const x = tokens(a), y = tokens(b);
  if (!x.length || !y.length) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.every((t) => long.includes(t));
}
type Candidate = { value: string; confidence: number; photo: number };
/** Groups confident readings of one field into sets that agree with each other. */
function groupsOf(field: KeyField, readings: readonly LabelReading[]) {
  const groups: Candidate[][] = [];
  readings.forEach((r, photo) => {
    const value = r[field]?.trim(), confidence = confidenceOf(r, field);
    if (!value || confidence < CONFIDENT) return;
    const group = groups.find((g) => g.every((c) => compatible(field, c.value, value)));
    if (group) group.push({ value, confidence, photo }); else groups.push([{ value, confidence, photo }]);
  });
  return groups;
}
/** Within agreeing readings: the most complete value, then the most confident. */
const best = (group: Candidate[]) => [...group].sort((a, b) => b.value.replace(/\W/g, "").length - a.value.replace(/\W/g, "").length || b.confidence - a.confidence || a.photo - b.photo)[0];

export function mergeLabelReadings(readings: readonly LabelReading[], choices: LabelChoices = {}): MergedLabel {
  if (!readings.length) return { label: {}, conflicts: [], missing: [...KEY_FIELDS] };
  const label: LabelReading = {}, confidence = { drugName: 0, strength: 0, ndc: 0, form: 0 }, conflicts: LabelConflict[] = [], missing: KeyField[] = [];
  for (const field of KEY_FIELDS) {
    const groups = groupsOf(field, readings);
    let picked: Candidate | undefined;
    if (groups.length > 1) {
      const options = groups.map((g) => ({ value: best(g).value, photos: [...new Set(g.map((c) => c.photo))] }));
      const choice = choices[field];
      // Never guessed: the field stays empty until the person picks one of the readings.
      if (choice === undefined || !Number.isInteger(choice) || !groups[choice]) { conflicts.push({ field, options }); continue; }
      picked = best(groups[choice]);
      picked = { ...picked, confidence: Math.max(...groups[choice].map((c) => c.confidence)) };
    } else if (groups.length === 1) picked = { ...best(groups[0]), confidence: Math.max(...groups[0].map((c) => c.confidence)) };
    else {
      missing.push(field);
      // No confident reading: keep the strongest weak one with its low confidence, exactly as a single photo would,
      // so the existing checks (e.g. "We couldn't read the medicine name") still decide.
      const weak = readings.map((r, photo) => ({ value: r[field]?.trim(), confidence: confidenceOf(r, field), photo })).filter((c): c is Candidate => Boolean(c.value)).sort((a, b) => b.confidence - a.confidence)[0];
      picked = weak;
    }
    if (picked) { label[field] = picked.value; confidence[field] = picked.confidence; }
  }
  // One photo is exactly today's check: its reading goes through untouched.
  if (readings.length === 1) return { label: structuredClone(readings[0]), conflicts, missing };
  const form = readings.map((r, photo) => ({ value: r.form?.trim(), confidence: confidenceOf(r, "form"), photo })).filter((c) => c.value).sort((a, b) => b.confidence - a.confidence)[0];
  if (form?.value) { label.form = form.value; confidence.form = form.confidence; }
  const first = <K extends "pharmacyName" | "directions">(k: K) => readings.map((r) => r[k]?.trim()).find(Boolean);
  const pharmacyName = first("pharmacyName"), directions = first("directions");
  if (pharmacyName) label.pharmacyName = pharmacyName;
  if (directions) label.directions = directions;
  // One photo of the bottle's side may not show the pharmacy header; any photo that does settles it.
  const rx = readings.map((r) => r.isPrescriptionLabel);
  if (rx.includes(true)) label.isPrescriptionLabel = true; else if (rx.includes(false)) label.isPrescriptionLabel = false;
  if (readings.some((r) => r.confidence)) label.confidence = confidence;
  return { label, conflicts, missing };
}

/** "Metformin HCl 1,000 mg · NDC 70010-065": only what was read. */
export function labelSummary(label: LabelReading) {
  const name = [label.drugName, label.strength].filter(Boolean).join(" ");
  return [name, label.ndc ? `NDC ${label.ndc}` : ""].filter(Boolean).join(" · ");
}

export type TypedFields = { mode: "ndc" | "name"; ndc: string; drugName: string; strength: string; side1: string; side2: string; colors: string[]; shape: string; form: string; uncertain: boolean };
export const EMPTY_TYPED: TypedFields = { mode: "ndc", ndc: "", drugName: "", strength: "", side1: "", side2: "", colors: [], shape: "", form: "tablet", uncertain: false };

export function typedRequest(fields: TypedFields) {
  return {
    label: fields.mode === "ndc" ? { ndc: fields.ndc.trim(), form: fields.form } : { drugName: fields.drugName.trim(), strength: fields.strength.trim(), form: fields.form },
    pill: { imprintSides: [fields.side1, fields.side2].map(s => s.trim()).filter(Boolean), imprintConfidence: fields.uncertain ? 0.4 : 1, colors: fields.colors, colorConfidence: fields.colors.length ? 1 : 0, shape: fields.shape, shapeConfidence: fields.shape ? 1 : 0, form: fields.form, guess: null },
  };
}

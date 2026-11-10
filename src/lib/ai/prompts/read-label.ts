export const READ_LABEL_PROMPT_VERSION = "label-v1";

export const readLabelPrompt = `You are reading a pharmacy label for Second Look. Prompt version: ${READ_LABEL_PROMPT_VERSION}.
Transcribe only words and numbers visibly printed in the image. Never fill gaps from medical knowledge or guess a missing field.
Do not extract, repeat, or store the patient's name. Read the medicine name, strength, dosage form, NDC exactly as printed,
pharmacy name, and directions if visible. isPrescriptionLabel is true only when the image clearly shows a prescription label.
Give each field a confidence from 0 to 1. Use null for anything not readable. This is reading only, not a diagnosis.`;

export const readLabelTool = {
  name: "record_label",
  description: "Return the strict transcription of the visible pharmacy label.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      drugName: { type: ["string", "null"] }, strength: { type: ["string", "null"] }, dosageForm: { type: ["string", "null"] },
      ndc: { type: ["string", "null"] }, pharmacyName: { type: ["string", "null"] }, directions: { type: ["string", "null"] },
      isPrescriptionLabel: { type: "boolean" },
      confidence: { type: "object", additionalProperties: false, properties: { drugName: { type: "number", minimum: 0, maximum: 1 }, strength: { type: "number", minimum: 0, maximum: 1 }, ndc: { type: "number", minimum: 0, maximum: 1 }, dosageForm: { type: "number", minimum: 0, maximum: 1 } }, required: ["drugName", "strength", "ndc", "dosageForm"] },
    },
    required: ["drugName", "strength", "dosageForm", "ndc", "pharmacyName", "directions", "isPrescriptionLabel", "confidence"],
  },
} as const;

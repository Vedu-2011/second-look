export const READ_PILL_PROMPT_VERSION = "pill-v1";

export const readPillPrompt = `You are reading one pill for Second Look. Prompt version: ${READ_PILL_PROMPT_VERSION}.
Report exactly what is visible. Do not correct an imprint to a known medicine. Preserve one string per visible side.
Use our FDA color words when possible. Report photo problems: blur, glare, too far, or imprint side down.
The guess is a separate lead only. Code will verify it against FDA records; the guess must never decide the verdict.
If no pill is visible, pillVisible is false. If more than one pill is visible, multiplePills is true. This is reading only.`;

export const readPillTool = {
  name: "record_pill",
  description: "Return the strict transcription and appearance reading of the visible pill.",
  input_schema: {
    type: "object", additionalProperties: false,
    properties: {
      imprintSides: { type: "array", items: { type: "string" }, maxItems: 4 }, imprintConfidence: { type: "number", minimum: 0, maximum: 1 },
      colors: { type: "array", items: { type: "string", enum: ["black", "blue", "brown", "gray", "green", "orange", "pink", "purple", "red", "turquoise", "white", "yellow", "off-white", "beige"] }, maxItems: 3 }, colorConfidence: { type: "number", minimum: 0, maximum: 1 },
      shape: { type: "string" }, shapeConfidence: { type: "number", minimum: 0, maximum: 1 }, form: { type: "string" }, pillVisible: { type: "boolean" }, multiplePills: { type: "boolean" },
      photoProblems: { type: "array", items: { type: "string", enum: ["blur", "glare", "too far", "imprint side down"] }, maxItems: 4 }, scored: { type: ["boolean", "null"] },
      guess: { type: ["object", "null"], properties: { drugName: { type: "string" }, strength: { type: ["string", "null"] } }, required: ["drugName", "strength"], additionalProperties: false },
    },
    required: ["imprintSides", "imprintConfidence", "colors", "colorConfidence", "shape", "shapeConfidence", "form", "pillVisible", "multiplePills", "photoProblems", "scored", "guess"],
  },
} as const;

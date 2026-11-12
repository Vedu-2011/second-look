// Bottle mode only: one photo crop of pills that touch or overlap. Separate from read-pill (pill-v3), which stays frozen.
export const READ_PILL_GROUP_PROMPT_VERSION = "pill-group-v1";

const COLORS = ["black", "blue", "brown", "gray", "green", "orange", "pink", "purple", "red", "turquoise", "white", "yellow", "off-white", "beige"] as const;

export const readPillGroupPrompt = `You are reading a small pile of pills for Second Look. Prompt version: ${READ_PILL_GROUP_PROMPT_VERSION}.
The image is a crop of a photo where several pills touch or overlap. Return one entry per pill you can actually see, even partly.
For each pill: its center and a box around the visible part, as fractions of THIS crop (0 to 1, x from the left, y from the top). Then read it exactly like a single pill:
Report exactly what is visible. Do not correct an imprint to a known medicine. Preserve one string per visible side; usually only one side shows.
Copy only the letters/numbers on the pill, stamped into it or printed on it in ink, not a description or medicine name. Printed text on shiny softgels is often small, faint and curved: look closely before calling a side blank, and if you can see characters but not every one clearly, copy what you see and lower imprintConfidence. Return imprintSides: [] only when the visible side has no characters at all. Never infer text from the other side, from a neighbouring pill, or from a familiar pill. Keep imprint strings at most 40 characters, shape at most 30, and form at most 20.
imprintConfidence measures legibility of the characters you transcribed, not confidence in identifying a medicine. Missing, blurred, covered or ambiguous characters must lower confidence. Never fill in missing characters.
partlyHidden is true when another pill or object covers any part of this pill.
Never invent a pill you cannot see, and never guess the imprint of a hidden pill. pileCount is your best count of pills in the crop, including ones you can only partly see; countConfidence is how sure you are of that count. somePillsMayBeHidden is true if pills could be lying completely under others.
Use our FDA color words when possible. Report photo problems: blur, glare, too far, or imprint side down. This is reading only.`;

const fraction = { type: "number", minimum: 0, maximum: 1 } as const;
export const readPillGroupTool = {
  name: "record_pill_group",
  description: "Return one strict reading per visible pill in this crop, plus the pile count.",
  input_schema: {
    type: "object", additionalProperties: false,
    properties: {
      pills: {
        type: "array", maxItems: 20,
        items: {
          type: "object", additionalProperties: false,
          properties: {
            center: { type: "object", additionalProperties: false, properties: { x: fraction, y: fraction }, required: ["x", "y"] },
            box: { type: "object", additionalProperties: false, properties: { x: fraction, y: fraction, width: fraction, height: fraction }, required: ["x", "y", "width", "height"] },
            imprintSides: { type: "array", items: { type: "string" }, maxItems: 4 }, imprintConfidence: fraction,
            colors: { type: "array", items: { type: "string", enum: COLORS }, maxItems: 3 }, colorConfidence: fraction,
            shape: { type: "string" }, shapeConfidence: fraction, form: { type: "string" },
            partlyHidden: { type: "boolean" },
            photoProblems: { type: "array", items: { type: "string", enum: ["blur", "glare", "too far", "imprint side down"] }, maxItems: 4 },
          },
          required: ["center", "box", "imprintSides", "imprintConfidence", "colors", "colorConfidence", "shape", "shapeConfidence", "form", "partlyHidden", "photoProblems"],
        },
      },
      pileCount: { type: "integer", minimum: 0, maximum: 40 },
      countConfidence: fraction,
      somePillsMayBeHidden: { type: "boolean" },
    },
    required: ["pills", "pileCount", "countConfidence", "somePillsMayBeHidden"],
  },
} as const;

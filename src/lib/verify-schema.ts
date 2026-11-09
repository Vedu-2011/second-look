// Input for POST /api/verify: what phase 2's photo reading will produce. Validated before anything runs.
import * as z from "zod";
import { isPlausibleNdc } from "@/lib/fda/ndc";

const text = (max: number) => z.string().trim().max(max);
const confidence = z.number().min(0).max(1);

export const verifyInputSchema = z.object({
  label: z
    .object({
      ndc: text(20).optional(),
      drugName: text(120).optional(),
      strength: text(40).optional(),
      form: text(40).optional(),
    })
    .refine((l) => Boolean(l.ndc) || Boolean(l.drugName), {
      error: "Add the NDC or the medicine name from the label.",
      path: ["ndc"],
    })
    .refine((l) => !l.ndc || isPlausibleNdc(l.ndc), {
      error: "That NDC doesn't look right. It's usually 10 or 11 digits, like 0573-0160-17.",
      path: ["ndc"],
    }),
  pill: z.object({
    imprintSides: z.array(text(40)).max(4),
    imprintConfidence: confidence,
    colors: z.array(text(30)).max(3),
    colorConfidence: confidence,
    shape: text(30),
    shapeConfidence: confidence,
    form: text(20).optional(),
    guess: z
      .object({ drugName: text(120).min(1), strength: text(40).optional() })
      .nullable()
      .optional(),
  }),
});

export type VerifyInput = z.infer<typeof verifyInputSchema>;

/** First problem, in words a person can act on. */
export function firstProblem(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) return "Something in the request isn't right.";
  if (issue.code === "custom") return issue.message;
  const where = issue.path.join(".");
  return `Please check ${where || "the request"}: ${issue.message.toLowerCase()}.`;
}

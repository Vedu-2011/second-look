import { connection } from "next/server";
import { runCheck } from "@/lib/check-service";
import { friendlyFdaMessage } from "@/lib/fda/http";
import { firstProblem, verifyInputSchema } from "@/lib/verify-schema";
import { recordedLead } from "@/lib/recorded-lead";

// POST { label, pill } → full, FDA-backed result. Phase 2 sends what Claude read off the photos; /dev/check sends typed values.
export async function POST(request: Request) {
  await connection();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "We couldn't read that request. Please send JSON." }, { status: 400 });
  }
  const parsed = verifyInputSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: firstProblem(parsed.error) }, { status: 400 });

  try {
    const pill = parsed.data.pill;
    const result = await runCheck(parsed.data.label, { ...pill, guess: pill.guess ?? recordedLead(pill) });
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return Response.json({ error: friendlyFdaMessage(err) }, { status: 502 });
  }
}

import { connection } from "next/server";
import { explain } from "@/lib/ai/explain";
import { AiUnavailableError } from "@/lib/ai/client";
import { readLabel, readPill } from "@/lib/ai/readers";
import { CHECK_BODY_MAX, checkRequestSchema, earlyExit, parseImageDataUrl, type CheckEvent } from "@/lib/check-input";
import { runCheck } from "@/lib/check-service";
import { friendlyFdaMessage } from "@/lib/fda/http";
import { consumeCheckLimit } from "@/lib/rate-limit";
import { saveResult } from "@/lib/result-store";

const encoder = new TextEncoder();
const line = (event: CheckEvent) => encoder.encode(`${JSON.stringify(event)}\n`);
export const maxDuration = 60;

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  await connection();
  let raw: unknown;
  try { raw = await request.json(); } catch { return Response.json({ error: "We couldn't read those photos. Please choose them again." }, { status: 400 }); }
  const parsed = checkRequestSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Please choose one clear label photo and one clear pill photo." }, { status: 400 });
  if (JSON.stringify(parsed.data).length > CHECK_BODY_MAX) return Response.json({ error: "Those photos are too large together. Please retake them or choose smaller files." }, { status: 413 });

  let labelImage: ReturnType<typeof parseImageDataUrl>;
  let pillImage: ReturnType<typeof parseImageDataUrl>;
  try {
    labelImage = parseImageDataUrl(parsed.data.labelImage.dataUrl);
    pillImage = parseImageDataUrl(parsed.data.pillImage.dataUrl);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Please choose a supported image." }, { status: 400 });
  }
  const limit = await consumeCheckLimit(clientIp(request));
  if (!limit.allowed) return Response.json({ error: limit.message }, { status: 429, headers: { "cache-control": "no-store" } });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: CheckEvent) => controller.enqueue(line(event));
      const close = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };
      const work = async () => {
        const started = performance.now();
        send({ type: "step", step: 0, state: "working" });
        send({ type: "step", step: 1, state: "working" });
        try {
          const [label, pill] = await Promise.all([readLabel(labelImage), readPill(pillImage)]);
          send({ type: "reading", kind: "label", value: label });
          send({ type: "reading", kind: "pill", value: pill });
          send({ type: "step", step: 0, state: "done" });
          send({ type: "step", step: 1, state: "done" });
          const exit = earlyExit(label, pill);
          if (exit) {
            send({ type: "step", step: exit.kind === "label" ? 0 : 1, state: "failed" });
            send({ type: "early_exit", ...exit });
            close();
            return;
          }
          send({ type: "step", step: 2, state: "working" });
          const result = await runCheck(label, pill);
          send({ type: "step", step: 2, state: "done" });
          send({ type: "step", step: 3, state: "working" });
          const explanation = await explain(result);
          const id = await saveResult({ result, explanation });
          send({ type: "step", step: 3, state: "done" });
          send({ type: "result", result: { ...result, shareId: id }, explanation, timings: { ...result.timings, ai: Math.round(performance.now() - started) } });
        } catch (error) {
          const message = error instanceof AiUnavailableError ? "AI reading isn't configured on this deployment yet. Add ANTHROPIC_API_KEY to try a real photo." : friendlyFdaMessage(error);
          send({ type: "error", message });
        } finally { close(); }
      };
      void work();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", connection: "keep-alive" } });
}

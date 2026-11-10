import { connection } from "next/server";
import { AiUnavailableError } from "@/lib/ai/client";
import {
  CHECK_BODY_MAX,
  checkRequestSchema,
  parseImageDataUrl,
  type CheckEvent,
} from "@/lib/check-input";
import { runPhotoCheck, finishPhotoCheck } from "@/lib/photo-check";
import { saveFlip, getFlip } from "@/lib/flip-store";
import { friendlyFdaMessage } from "@/lib/fda/http";
import { consumeCheckLimit } from "@/lib/rate-limit";
import { saveResult } from "@/lib/result-store";

const encoder = new TextEncoder();
const line = (event: CheckEvent) =>
  encoder.encode(`${JSON.stringify(event)}\n`);
export const maxDuration = 60;

function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: Request) {
  await connection();
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json(
      { error: "We couldn't read those photos. Please choose them again." },
      { status: 400 },
    );
  }
  const parsed = checkRequestSchema.safeParse(raw);
  if (!parsed.success)
    return Response.json(
      {
        error: "Please choose one clear label photo and one clear pill photo.",
      },
      { status: 400 },
    );
  if (JSON.stringify(parsed.data).length > CHECK_BODY_MAX)
    return Response.json(
      {
        error:
          "Those photos are too large together. Please retake them or choose smaller files.",
      },
      { status: 413 },
    );

  let labelImage: ReturnType<typeof parseImageDataUrl>;
  let pillImage: ReturnType<typeof parseImageDataUrl>;
  let otherImage: ReturnType<typeof parseImageDataUrl> | null = null;
  let previous: Awaited<ReturnType<typeof getFlip>> = null;
  try {
    if ("continuationId" in parsed.data) {
      previous = await getFlip(parsed.data.continuationId);
      if (!previous)
        return Response.json(
          {
            error:
              "That check expired. Please start with the label photo again.",
          },
          { status: 410 },
        );
      if (parsed.data.otherSideImage)
        otherImage = parseImageDataUrl(parsed.data.otherSideImage.dataUrl);
    } else {
      labelImage = parseImageDataUrl(parsed.data.labelImage.dataUrl);
      pillImage = parseImageDataUrl(parsed.data.pillImage.dataUrl);
    }
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Please choose a supported image.",
      },
      { status: 400 },
    );
  }
  const limit = await consumeCheckLimit(clientIp(request));
  if (!limit.allowed)
    return Response.json(
      { error: limit.message },
      { status: 429, headers: { "cache-control": "no-store" } },
    );

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
        try {
          const checked = previous
            ? await finishPhotoCheck(previous, otherImage, send)
            : await runPhotoCheck(labelImage!, pillImage!, send, true);
          if (!checked.ok) {
            if ("flip" in checked && checked.flip)
              send({
                type: "flip",
                continuationId: await saveFlip(checked.flip),
                reason: checked.reason,
              });
            return;
          }
          const { result, explanation, timings } = checked;
          const id = await saveResult({ result, explanation });
          send({ type: "step", step: 3, state: "done" });
          send({
            type: "result",
            result: { ...result, shareId: id },
            explanation,
            timings,
          });
        } catch (error) {
          const message =
            error instanceof AiUnavailableError
              ? "Photo reading is unavailable right now. Try a saved sample or type what's on your pill."
              : friendlyFdaMessage(error);
          send({ type: "error", message });
        } finally {
          close();
        }
      };
      void work();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive",
    },
  });
}

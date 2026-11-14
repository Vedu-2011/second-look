/** Reads a multipart form, counting the streamed bytes too, rather than trusting Content-Length or buffering unlimited uploads. */
export async function boundedForm(request: Request, maxBytes: number, tooLarge: string, missing: string) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) throw new Error(missing);
  if (Number(request.headers.get("content-length") || 0) > maxBytes) throw new Error(tooLarge);
  const reader = request.body?.getReader();
  if (!reader) throw new Error(missing);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error(tooLarge); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return new Response(Buffer.concat(chunks), { headers: { "content-type": request.headers.get("content-type")! } }).formData();
}

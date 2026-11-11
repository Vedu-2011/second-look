/** Decimal byte limits leave headroom under Vercel's 4.5 MB Function limit. */
export const BOTTLE_UPLOAD_BYTES = 3_000_000;
export const LABEL_UPLOAD_BYTES = 700_000;
export const BOTTLE_BODY_BYTES = 4_000_000;
export const BOTTLE_DECODED_PIXELS = 32_000_000;
export const BOTTLE_SELECTION_BYTES = 12 * 1024 * 1024;

export async function prepareBottlePhoto(file: File, kind: "label" | "bottle") {
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) throw new Error("Choose a JPG, PNG, WebP, or GIF photograph.");
  if (file.size > BOTTLE_SELECTION_BYTES) throw new Error("Choose a photograph under 12 MB.");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    if (bitmap.width * bitmap.height > BOTTLE_DECODED_PIXELS) throw new Error("Choose a photograph under 32 megapixels.");
    const canvas = document.createElement("canvas");
    // Bottle dimensions NEVER shrink: the server crops these full-resolution pixels.
    const scale = kind === "label" ? Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height)) : 1;
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("We couldn't prepare that photo. Try another photograph.");
    context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const cap = kind === "label" ? LABEL_UPLOAD_BYTES : BOTTLE_UPLOAD_BYTES;
    for (const quality of [0.94, 0.88, 0.8, 0.7, 0.6, 0.5, 0.4]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= cap) return { blob, preview: URL.createObjectURL(blob), width: canvas.width, height: canvas.height };
    }
    throw new Error("This photo is too detailed to upload at full resolution. Use a plain background and try again, or check one pill.");
  } finally { bitmap.close(); }
}

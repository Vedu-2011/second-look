import { afterEach, describe, expect, it, vi } from "vitest";
import { BOTTLE_UPLOAD_BYTES, prepareBottlePhoto } from "./upload";

afterEach(() => vi.unstubAllGlobals());
function setup(width = 4000, height = 3000, fits = true) {
  const close = vi.fn(); vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width, height, close })));
  const canvas = { width: 0, height: 0, getContext: () => ({ fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: "" }), toBlob: vi.fn((callback, _type, quality) => callback(new Blob([new Uint8Array(fits && quality < .9 ? 1000 : BOTTLE_UPLOAD_BYTES + 1)], { type: "image/jpeg" }))) };
  vi.stubGlobal("document", { createElement: () => canvas }); return { canvas, close };
}
describe("full-resolution bottle upload", () => {
  it("recompresses bytes without changing bottle dimensions", async () => {
    const { canvas, close } = setup();
    const photo = await prepareBottlePhoto(new File(["bytes"], "photo.jpg", { type: "image/jpeg" }), "bottle");
    expect([canvas.width, canvas.height]).toEqual([4000, 3000]); expect(photo.blob.size).toBeLessThan(BOTTLE_UPLOAD_BYTES); expect(canvas.toBlob).toHaveBeenCalledTimes(2); expect(close).toHaveBeenCalledOnce(); URL.revokeObjectURL(photo.preview);
  });
  it("fails with a friendly message if full dimensions cannot fit", async () => {
    const { canvas } = setup(4000,3000,false);
    await expect(prepareBottlePhoto(new File(["bytes"], "photo.jpg", { type: "image/jpeg" }), "bottle")).rejects.toThrow("full resolution"); expect([canvas.width, canvas.height]).toEqual([4000,3000]);
  });
  it("caps decoded pixels separately and releases the bitmap", async () => {
    const { close } = setup(8000,8000);
    await expect(prepareBottlePhoto(new File(["bytes"], "photo.jpg", { type: "image/jpeg" }), "bottle")).rejects.toThrow("32 megapixels"); expect(close).toHaveBeenCalledOnce();
  });
});

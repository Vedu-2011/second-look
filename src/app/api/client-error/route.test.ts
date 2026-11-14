// Phase 11g: the browser's failure note logs only safe fields, and at most 10 a minute per IP.
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/redis", () => ({ getRedis: () => null, key: (v: string) => "sl:" + v }));
const { POST } = await import("./route");
const { clearNotesForTests } = await import("@/lib/rate-limit");
const note = (body: unknown, ip = "1.2.3.4") => new Request("http://localhost/api/client-error", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "x-forwarded-for": ip, "user-agent": "iPhone Safari" } });
let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => { clearNotesForTests(); warn = vi.spyOn(console, "warn").mockImplementation(() => {}); });

it("logs the kind of failure, never a photo or anything else it was sent", async () => {
  expect((await POST(note({ why: "network", kind: "ours", name: "TypeError", message: "Load failed", attempt: 1, bytes: 3412004.4, photo: "data:image/jpeg;base64,AAAA", label: "Jane" }))).status).toBe(204);
  const logged = String(warn.mock.calls[0][1]);
  expect(JSON.parse(logged)).toEqual({ why: "network", kind: "ours", name: "TypeError", message: "Load failed", attempt: 1, bytes: 3412004, followUp: false, userAgent: "iPhone Safari" });
  expect(logged).not.toContain("base64"); expect(logged).not.toContain("Jane");
});
it("garbage is fine, and more than 10 a minute from one IP aren't logged", async () => {
  expect((await POST(note("not json"))).status).toBe(204);
  for (let i = 0; i < 14; i++) await POST(note({ why: "network" }));
  expect(warn).toHaveBeenCalledTimes(10);
  await POST(note({ why: "network" }, "5.6.7.8"));
  expect(warn).toHaveBeenCalledTimes(11);
});
it("a big body is never read past 2 KB or logged, even without a Content-Length", async () => {
  const big = new ReadableStream<Uint8Array>({ start(c) { for (let i = 0; i < 50; i++) c.enqueue(new Uint8Array(1000).fill(65)); c.close(); } });
  const request = new Request("http://localhost/api/client-error", { method: "POST", body: big, duplex: "half" } as RequestInit);
  expect((await POST(request)).status).toBe(204);
  expect(warn).not.toHaveBeenCalled();
});

// Phase 11g: with a deadline, no AI request starts after it and each one's timeout shrinks to the time left.
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const create = vi.fn(), constructed: Record<string, unknown>[] = [];
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create }; constructor(options: Record<string, unknown>) { constructed.push(options); } } }));
const { toolRead } = await import("./client");
const read = (deadline?: number) => toolRead({ image: { mediaType: "image/png", base64: "" }, system: "", tool: { name: "t", description: "", input_schema: {} }, validate: (v) => v, deadline });

beforeEach(() => { process.env.ANTHROPIC_API_KEY = "test"; create.mockReset(); constructed.length = 0; });
afterEach(() => { delete process.env.ANTHROPIC_API_KEY; });

it("starts nothing once the deadline is (nearly) up", async () => {
  await expect(read(Date.now() + 1000)).rejects.toThrow("No time left");
  expect(create).not.toHaveBeenCalled();
});
it("each try gets only the time left, and the SDK doesn't retry on its own", async () => {
  create.mockRejectedValue(new Error("timed out"));
  await expect(read(Date.now() + 20_000)).rejects.toThrow("timed out");
  expect(create).toHaveBeenCalledTimes(2);
  for (const call of create.mock.calls) expect(call[1].timeout).toBeLessThanOrEqual(20_000);
  expect(constructed[0].maxRetries).toBe(0);
});
it("without a deadline: the usual 45 s timeout and one SDK retry", async () => {
  create.mockResolvedValue({ usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "tool_use", input: { ok: true } }] });
  expect(await read()).toEqual({ ok: true });
  expect(create.mock.calls[0][1].timeout).toBe(45_000); expect(constructed[0].maxRetries).toBe(1);
});

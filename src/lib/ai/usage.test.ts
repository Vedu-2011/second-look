import { afterEach, expect, it, vi } from "vitest";
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create }; } }));
const { toolRead } = await import("./client");
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
const response = (input: number) => ({ content: [{ type: "tool_use", input: { ok: true } }], usage: { input_tokens: input, output_tokens: 10 } });
const params = { image: { mediaType: "image/png" as const, base64: "test" }, system: "test", tool: { name: "read", description: "read", input_schema: {} }, validate: (value: unknown) => value };
it("records both paid responses when the first reading needs a retry", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test"); create.mockResolvedValueOnce(response(100)).mockResolvedValueOnce(response(101));
  const onUsage = vi.fn(), beforeAttempt = vi.fn(async () => {}); let valid = false;
  await toolRead({ ...params, onUsage, beforeAttempt, validate: (v) => { if (!valid) { valid = true; throw new Error("Invalid first reading"); } return v; } });
  expect(onUsage).toHaveBeenCalledTimes(2); expect(beforeAttempt).toHaveBeenCalledTimes(2);
});
it("pre-call reservation failure cannot create a model request", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test");
  await expect(toolRead({ ...params, beforeAttempt: async () => { throw new Error("Budget"); } })).rejects.toThrow("Budget");
  expect(create).not.toHaveBeenCalled();
});
it("concurrent request observers cannot overwrite or mix their token counts", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test"); create.mockResolvedValueOnce(response(100)).mockResolvedValueOnce(response(200));
  const a = vi.fn(), b = vi.fn(); await Promise.all([toolRead({ ...params, onUsage: a }), toolRead({ ...params, onUsage: b })]);
  expect(a).toHaveBeenCalledExactlyOnceWith("claude-sonnet-5-5", 100, 10); expect(b).toHaveBeenCalledExactlyOnceWith("claude-sonnet-5-5", 200, 10);
});

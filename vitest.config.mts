import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Lets tests import route handlers that use the "@/..." path alias (same as tsconfig).
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Image tests run sharp on real photos; with every file in parallel they can pass the 5 s default on a busy laptop.
  test: { testTimeout: 15000 },
});

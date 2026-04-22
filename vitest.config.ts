import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@test": path.resolve(__dirname, "tests"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/smoke/**"],
    testTimeout: 30000,
    hookTimeout: 10000,
  },
});

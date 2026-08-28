import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/qualification/toolchain/**/*.test.mjs"],
    passWithNoTests: false,
    reporters: ["default"],
    testTimeout: 10_000,
  },
});

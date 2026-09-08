import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/qualification/kernel/**/*.test.mjs"],
    passWithNoTests: false,
    maxWorkers: 1,
    testTimeout: 20_000,
  },
});

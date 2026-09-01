import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/qualification/phase-1/**/*.test.mjs"],
    maxWorkers: 1,
  },
});

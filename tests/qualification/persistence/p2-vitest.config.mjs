import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/qualification/persistence/p2-result-journal.test.mjs",
      "tests/fault-injection/persistence/p2-result-journal.test.mjs",
    ],
    passWithNoTests: false,
    maxWorkers: 1,
    testTimeout: 20_000,
  },
});
